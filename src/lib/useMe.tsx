'use client';

import { useEffect, useState } from 'react';

export interface Me {
  authenticated: boolean;
  email?: string;
  user_id?: string | null;
  name?: string;
  app_role: 'admin' | 'elder' | 'publisher';
  permissions: string[];
  is_regular_pioneer?: boolean;
  is_special_pioneer?: boolean;
  is_auxiliary_pioneer?: boolean;
  congregation_id?: string | null;
  congregation_name?: string | null;
  congregation_city?: string | null;
  /** Module keys this congregation can access (null = all) */
  enabled_modules?: string[] | null;
  is_super_admin?: boolean;
}

let cache: Me | null = null;
let inflight: Promise<Me> | null = null;

async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/me', { cache: 'no-store' });
  const data = await res.json();
  return {
    authenticated: !!data.authenticated,
    email: data.email,
    user_id: data.user_id,
    name: data.name,
    app_role: data.app_role || 'publisher',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    is_regular_pioneer: !!data.is_regular_pioneer,
    is_special_pioneer: !!data.is_special_pioneer,
    is_auxiliary_pioneer: !!data.is_auxiliary_pioneer,
    congregation_id: data.congregation_id ?? null,
    congregation_name: data.congregation_name ?? null,
    congregation_city: data.congregation_city ?? null,
    enabled_modules: data.enabled_modules ?? null,
    is_super_admin: !!data.is_super_admin,
  };
}

export function invalidateMeCache() {
  cache = null;
  inflight = null;
}

export function useMe(): { me: Me | null; loading: boolean } {
  const [me, setMe] = useState<Me | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = fetchMe();
    inflight.then((m) => { cache = m; setMe(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { me, loading };
}

/** Can user access this module? Checks congregation enabled_modules + role + permissions. */
export function canAccess(me: Me | null, moduleKey: string, adminOnly?: boolean, superAdminOnly?: boolean): boolean {
  if (!me) return true; // still loading — don't block render
  if (superAdminOnly) return !!me.is_super_admin;
  if (me.is_super_admin) return true; // super-admin sees everything else
  if (adminOnly) return me.app_role === 'admin';
  // Admin always has full access — congregation-level gate only restricts elders/publishers
  if (me.app_role === 'admin') return true;
  // Check congregation-level module gate (elder and publisher)
  if (me.enabled_modules && !me.enabled_modules.includes(moduleKey)) return false;
  if (me.app_role === 'elder') return true;
  if (moduleKey === 'my-report') return true;
  return me.permissions.includes(moduleKey);
}
