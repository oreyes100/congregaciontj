# 🎯 WARGAME: Lost Group Reports Data Persistence

**ID:** WG-2026-009
**Created:** 2026-09-07
**Status:** 🔴 ACTIVE
**Severity:** HIGH
**Category:** Data Integrity / Persistence Bug
**Related Wargames:** msp-s13-cuentas-responsabilidades, msp-s14-aislamiento-congregacion-weekend

---

## 📋 Executive Summary

Field Service Group Reports submitted via the mobile app or web UI are occasionally not persisted to the `field_service_reports` table in Supabase. Users report successful submission (green toast), but reports vanish after refresh or never appear in coordinator dashboards. This wargame reproduces the silent failure mode and validates the fix ensuring all group reports are durably saved.

---

## 🔍 Root Cause Analysis (From Previous Wargames)

Based on patterns identified in previous data-loss wargames in this project:

| Pattern | Manifestation in Group Reports |
|---------|-------------------------------|
| Missing `await` on DB write | Report insert fires without waiting for Supabase response; function returns success prematurely |
| No error boundary on mutation | Supabase RLS/network errors swallowed silently; UI shows success regardless |
| Optimistic update without rollback | Local state updates immediately; if server rejects, stale data persists until next fetch |
| Transaction isolation | Multi-row inserts (group + members) partially committed; orphaned records or missing children |
| Cache invalidation gap | React Query cache not invalidated on success; stale list shown even when DB has record |

### Specific Suspected Code Paths
- `src/app/api/field-service/reports/route.ts` — POST handler may lack proper error propagation
- `src/services/field-service-report.service.js` — Batch insert logic may not use transactions
- `src/components/field-service/GroupReportForm.tsx` — Mutation onSuccess may not verify server confirmation
- Supabase RLS policies on `field_service_reports` — May silently reject based on group membership timing

---

## 🧪 Reproduction Scenarios

### Scenario 1: Silent Network Failure During Submit
**Precondition:** User authenticated as group overseer with valid group_id
**Steps:**
1. Open Field Service > Group Report form
2. Fill in all required fields (date, hours, publishers present)
3. Throttle network to "Slow 3G" or disconnect before submit
4. Click "Submit Report"
5. Observe UI feedback
6. Reconnect network and refresh page

**Expected (Buggy):** Green success toast appears; report NOT in database after refresh
**Expected (Fixed):** Error toast with retry option; no false success indicator

### Scenario 2: Concurrent Duplicate Submission
**Precondition:** Two overseers from same group submit simultaneously
**Steps:**
1. Overseer A opens report form for Group X, date 2026-09-06
2. Overseer B opens same form, same group, same date
3. Both click submit within 500ms window
4. Check database for duplicate or missing records

**Expected (Buggy):** One report lost silently OR duplicate created without constraint violation
**Expected (Fixed):** Unique constraint enforced; second submit returns clear conflict message; first report persisted

### Scenario 3: Partial Batch Insert (Group Header + Member Rows)
**Precondition:** Report with 5+ publisher entries
**Steps:**
1. Create report with header + 8 member detail rows
2. Force Supabase timeout mid-insert (via proxy or db latency injection)
3. Check `field_service_reports` AND `field_service_report_members` tables

**Expected (Buggy):** Header exists but member rows missing (orphaned header); no error shown
**Expected (Fixed):** Atomic transaction — either ALL rows persist or NONE; user prompted to retry

### Scenario 4: RLS Policy Race Condition
**Precondition:** User just added to group (< 2 seconds ago)
**Steps:**
1. Admin adds user to `field_service_groups` membership
2. User immediately submits report for that group
3. Check if report saved

**Expected (Buggy):** RLS policy hasn't propagated/cached; insert rejected silently
**Expected (Fixed):** Server validates membership explicitly before insert; clear error if not yet authorized

### Scenario 5: Mobile App Background Kill During Save
**Precondition:** Capacitor Android/iOS app
**Steps:**
1. Fill report form in mobile app
2. Tap submit
3. Immediately background/kill app before response arrives
4. Reopen app and check report list

**Expected (Buggy):** Report lost; local cache shows it but server doesn't have it
**Expected (Fixed):** Local pending queue retries on next app open; eventual consistency guaranteed

---

## ✅ Acceptance Criteria (Fix Validation)

### Must Pass Before Wargame Closure

- [ ] **AC-1:** All POST/PUT mutations to `/api/field-service/reports` return explicit `{ success: true, id: string }` or throw typed error
- [ ] **AC-2:** Database writes use Supabase `.rpc()` with transactional wrapper OR chained `.then()` with proper `await` at every level
- [ ] **AC-3:** UI mutation `onSuccess` verifies returned ID matches inserted record (not just HTTP 200)
- [ ] **AC-4:** UI mutation `onError` displays specific failure reason (network, validation, RLS, duplicate)
- [ ] **AC-5:** React Query `invalidateQueries(['field-service-reports'])` called ONLY after confirmed server persistence
- [ ] **AC-6:** Unique constraint `(group_id, report_date)` exists on `field_service_reports`; duplicates return 409 Conflict
- [ ] **AC-7:** Batch inserts (header + members) wrapped in single transaction or RPC function
- [ ] **AC-8:** Mobile app implements offline queue with retry-on-reconnect for failed submissions
- [ ] **AC-9:** Integration test covers all 5 reproduction scenarios above
- [ ] **AC-10:** Audit log entry created for every successful AND failed report submission attempt

---

## 🛠️ Implementation Checklist

### Phase 1: Diagnosis & Instrumentation
- [ ] Add structured logging to `/api/field-service/reports` POST handler (request body, Supabase response, timing)
- [ ] Add client-side mutation timing and error capture to `GroupReportForm`
- [ ] Verify current RLS policies on `field_service_reports` and `field_service_report_members`
- [ ] Check for existing unique constraints on `(group_id, report_date)`
- [ ] Review `auto-assign-service.js` for any cross-contamination with field service report writes

### Phase 2: Backend Fix
- [ ] Wrap multi-table inserts in Supabase RPC transaction function
- [ ] Add explicit error classification (network / validation / auth / conflict)
- [ ] Implement idempotency key support for mobile retry safety
- [ ] Add server-side validation that group membership exists BEFORE insert attempt
- [ ] Create migration for unique constraint if missing

### Phase 3: Frontend Fix
- [ ] Replace optimistic updates with server-confirmed updates only
- [ ] Add retry button on failed submissions with exponential backoff
- [ ] Show loading state that distinguishes "sending" from "confirmed saved"
- [ ] Invalidate cache only after verified server confirmation
- [ ] Add visual indicator for unsaved/pending reports in list view

### Phase 4: Mobile Resilience
- [ ] Implement local SQLite pending queue for offline submissions
- [ ] Add background sync worker that retries failed submissions on connectivity restore
- [ ] Persist submission timestamp locally for deduplication on retry
- [ ] Test kill-during-save scenario on both Android and iOS

### Phase 5: Testing & Verification
- [ ] Write Playwright E2E tests for Scenarios 1-4
- [ ] Write unit tests for transaction wrapper and error classification
- [ ] Load test: 50 concurrent submissions to same group/date → verify exactly 1 succeeds
- [ ] Manual mobile testing for Scenario 5
- [ ] Regression test against previous data-loss wargame fixes

---

## 📊 Metrics & Monitoring

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Report submission success rate | ≥ 99.5% | < 98% over 1 hour |
| Average save latency (p95) | < 800ms | > 2s |
| Failed saves with user-visible error | 100% of failures | Any silent failure detected |
| Duplicate report attempts blocked | 100% | Any duplicate reaching DB |
| Mobile retry success rate | ≥ 95% within 5 min | < 80% after reconnect |

### Log Queries for Monitoring
```sql
-- Find reports created but with no member rows (partial insert)
SELECT r.id, r.report_date, COUNT(m.id) as member_count
FROM field_service_reports r
LEFT JOIN field_service_report_members m ON m.report_id = r.id
WHERE r.created_at > NOW() - INTERVAL '7 days'
GROUP BY r.id, r.report_date
HAVING COUNT(m.id) = 0;

-- Find duplicate reports (should be zero after fix)
SELECT group_id, report_date, COUNT(*) as dup_count
FROM field_service_reports
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY group_id, report_date
HAVING COUNT(*) > 1;
```

---

## 🔗 Related Artifacts

- **Code:** `src/app/api/field-service/reports/route.ts`
- **Code:** `src/services/field-service-report.service.js`
- **Code:** `src/components/field-service/GroupReportForm.tsx`
- **Code:** `src/hooks/useFieldServiceReports.ts`
- **Schema:** `supabase/migrations/*_field_service.sql`
- **Previous Wargame:** `wargames/msp-s13-cuentas-responsabilidades.md`
- **Previous Wargame:** `wargames/msp-s14-aislamiento-congregacion-weekend.md`

---

## 📝 Post-Mortem Template (To Complete After Resolution)

```markdown
### What happened?
[Timeline of discovery and impact]

### Root cause confirmed?
[Which suspected pattern was the actual culprit?]

### Fix applied?
[PR links, migration IDs, deployment timestamps]

### How was it verified?
[Which ACs passed, which scenarios re-tested]

### Preventive measures added?
[New tests, monitoring alerts, architectural changes]

### Lessons learned?
[Patterns to watch for in other modules]
```

---

*This wargame follows the established pattern from previous data-integrity wargames in this project. All fixes must be validated against the acceptance criteria before closure. Do NOT mark as resolved until all 10 ACs pass and monitoring shows ≥ 99.5% success rate over 7 consecutive days.*
