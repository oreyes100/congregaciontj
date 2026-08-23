'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WeekendDashboard } from '@/components/WeekendDashboard';
import { SyncStatus } from '@/components/SyncStatus';
import { Sidebar } from '@/components/Sidebar';
import type { WeekendMeeting, PublicTalkOutline, PublicSpeaker, CongregationSettings } from '@/types';
import { useT } from '@/lib/i18n';

export default function WeekendPage() {
  const { locale } = useT();
  const safeLocale = (locale === 'es' ? 'es' : 'en') as 'en' | 'es';
  const [meetings, setMeetings] = useState<WeekendMeeting[]>([]);
  const [outlines, setOutlines] = useState<PublicTalkOutline[]>([]);
  const [visitingSpeakers, setVisitingSpeakers] = useState<PublicSpeaker[]>([]);
  const [localPersons, setLocalPersons] = useState<any[]>([]);
  const [congregation, setCongregation] = useState<CongregationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationSql, setMigrationSql] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, oRes, spRes, pRes] = await Promise.all([
        fetch('/api/weekend-meetings'),
        fetch('/api/public-talk-outlines'),
        fetch('/api/public-speakers'),
        fetch('/api/persons?limit=500'),
      ]);

      if (!mRes.ok) {
        const err = await mRes.json();
        const msg = String(err.error || '');
        if (
          msg.includes('does not exist') ||
          msg.includes('relation') ||
          msg.includes('Could not find the table') ||
          msg.includes('schema cache')
        ) {
          setMigrationNeeded(true);
          setLoading(false);
          return;
        }
        throw new Error(err.error || 'Error cargando reuniones');
      }

      const [mj, oj, spj, pj] = await Promise.all([mRes.json(), oRes.json(), spRes.json(), pRes.json()]);
      const loaded: WeekendMeeting[] = mj.meetings || [];
      setMeetings(loaded);
      // Open on the current week rather than an empty dashboard.
      setActiveId(prev => {
        if (prev) return prev;
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay())); // Monday of this week
        const monday = d.toISOString().slice(0, 10);
        const sunday = new Date(d.getTime() + 6 * 864e5).toISOString().slice(0, 10);
        const match = loaded.find(m => {
          const date = String(m.date || '').slice(0, 10);
          return date >= monday && date <= sunday;
        });
        return match?.id ?? null;
      });
      setOutlines(oj.outlines || []);
      setVisitingSpeakers(spj.speakers || []);
      setLocalPersons(pj.persons || []);
      setMigrationNeeded(false);
      // Congregation settings are optional — ignore if table not yet created
      try {
        const cRes = await fetch('/api/congregation');
        if (cRes.ok) setCongregation((await cRes.json()).congregation || null);
      } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createWeek = useCallback(async (date?: string) => {
    let iso = date;
    if (!iso) {
      const d = new Date();
      const day = d.getDay();
      const toSunday = day === 0 ? 7 : 7 - day;
      d.setDate(d.getDate() + toSunday - 6);
      iso = d.toISOString().slice(0, 10);
    }
    setCreating(true);
    try {
      const res = await fetch('/api/weekend-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: iso }),
      });
      if (res.ok) {
        const j = await res.json();
        await fetchData();
        setActiveId(j.meeting.id);
      } else {
        alert((await res.json()).error || 'Error al crear semana');
      }
    } finally {
      setCreating(false);
    }
  }, [fetchData]);

  const runMigration = async () => {
    setMigrating(true);
    try {
      const res = await fetch('/api/migrate-weekend', { method: 'POST' });
      const j = await res.json();
      if (j.success) {
        await fetchData();
      } else {
        // service_role can't create tables — surface the SQL for manual run
        if (j.sql) setMigrationSql(j.sql);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en migración');
    } finally {
      setMigrating(false);
    }
  };

  const copySql = async () => {
    let sql = migrationSql;
    if (!sql) {
      try {
        const r = await fetch('/api/migrate-weekend');
        sql = (await r.json()).sql || '';
        setMigrationSql(sql);
      } catch { /* ignore */ }
    }
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300 text-sm">Cargando…</div>;
  }

  if (migrationNeeded) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 overflow-y-auto">
        <div className="max-w-2xl w-full">
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2 text-center">Configuración inicial requerida</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-4 text-center">
            Las tablas de Reunión de Fin de Semana no existen aún. Intenta la migración automática;
            si el rol de servicio no tiene permisos para crear tablas, copia el SQL y pégalo en el
            <strong> SQL Editor de Supabase</strong>.
          </p>

          {!migrationSql ? (
            <div className="flex justify-center">
              <button
                onClick={runMigration}
                disabled={migrating}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm disabled:opacity-50"
              >
                {migrating ? 'Aplicando migración…' : 'Aplicar migración y continuar'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600 font-medium">
                  ⚠️ El rol de servicio no puede crear tablas. Ejecuta este SQL en Supabase → SQL Editor:
                </span>
                <button
                  onClick={copySql}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs"
                >
                  {copied ? '✓ Copiado' : 'Copiar SQL'}
                </button>
              </div>
              <textarea
                readOnly
                value={migrationSql}
                className="w-full h-72 border border-gray-300 dark:border-gray-600 rounded p-2 text-[11px] font-mono bg-gray-50 dark:bg-gray-900"
                onFocusCapture={e => e.currentTarget.select()}
              />
              <div className="flex justify-center gap-2">
                <a
                  href="https://supabase.com/dashboard/project/_/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  Abrir SQL Editor
                </a>
                <button
                  onClick={() => fetchData()}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 rounded text-sm"
                >
                  Ya lo ejecuté → Recargar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500 text-sm whitespace-pre">{error}</div>;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 font-sans pb-[52px] md:pb-0">
      <SyncStatus />
      <Sidebar
        meetings={meetings}
        activeMeetingId={activeId}
        setActiveMeetingId={setActiveId}
        onPrint={() => {}}
        onNewMeeting={createWeek}
        isCreating={creating}
        allowPast
        monthsBack={12}
      />
      <div className="flex-1 overflow-hidden">
        <WeekendDashboard
          meetings={meetings}
          outlines={outlines}
          visitingSpeakers={visitingSpeakers}
          localPersons={localPersons}
          locale={safeLocale}
          onRefresh={fetchData}
          activeId={activeId}
          setActiveId={setActiveId}
          congregation={congregation}
        />
      </div>
    </div>
  );
}
