'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sun, Moon, LayoutGrid, LogOut } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { MODULES, moduleByPath } from '@/lib/modules';
import { useMe, canAccess } from '@/lib/useMe';
import { supabase } from '@/lib/supabase';

const BADGE_CACHE_KEY = 'assignment_badge_count';
const BADGE_CACHE_TTL = 10 * 60 * 1000; // 10 min

export function IconSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useTheme();
  const { me } = useMe();
  const isDark = mode === 'dark';
  const [assignmentBadge, setAssignmentBadge] = useState(0);

  useEffect(() => {
    if (!me?.authenticated) return;
    try {
      const cached = sessionStorage.getItem(BADGE_CACHE_KEY);
      if (cached) {
        const { count, ts } = JSON.parse(cached);
        if (Date.now() - ts < BADGE_CACHE_TTL) { setAssignmentBadge(count); return; }
      }
    } catch { /* ignore */ }
    fetch('/api/my-assignments')
      .then(r => r.json())
      .then(d => {
        const all: { date: string }[] = d.assignments || [];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + 14);
        const count = all.filter(a => new Date(a.date + 'T00:00:00') <= cutoff).length;
        setAssignmentBadge(count);
        sessionStorage.setItem(BADGE_CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
      })
      .catch(() => {});
  }, [me?.authenticated]);

  const visible = MODULES.filter(m => canAccess(me, m.key, m.adminOnly, m.superAdminOnly));

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Gate: si el módulo actual no está permitido, redirigir al primero visible
  const current = moduleByPath(pathname);
  const blocked = !!me && !!current && !canAccess(me, current.key, current.adminOnly, current.superAdminOnly);
  useEffect(() => {
    if (blocked) router.replace(visible[0]?.path || '/my-report');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900/95 flex items-center justify-center text-white text-sm">
        Sin acceso a este módulo — redirigiendo…
      </div>
    );
  }

  return (
    <>
      {/* Cluster fijo (solo móvil): tema + salir, siempre alcanzables sin importar
          cuántos módulos tenga la barra inferior ni el scroll horizontal. */}
      <div className="md:hidden fixed z-50 flex gap-1.5" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)', right: 8 }}>
        <button onClick={() => setMode(isDark ? 'light' : 'dark')} title="Tema"
          className="p-2 rounded-full bg-black/40 backdrop-blur text-white shadow-lg">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={logout} title="Cerrar sesión"
          className="p-2 rounded-full bg-black/40 backdrop-blur text-white shadow-lg">
          <LogOut size={16} />
        </button>
      </div>

      <div className={`${isDark ? 'bg-gray-900' : 'bg-sky-500'} shrink-0
          flex md:flex-col items-center gap-1 md:gap-2 md:py-3 md:w-[52px]
          fixed bottom-0 left-0 right-0 z-40 h-[52px] px-1 overflow-x-auto
          md:static md:h-auto md:px-0 md:overflow-x-visible md:overflow-y-auto`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button onClick={() => router.push('/')} title="Inicio"
          className="p-2 rounded-md text-white hover:bg-sky-600 transition-colors shrink-0">
          <LayoutGrid size={22} />
        </button>
        {visible.map(({ key, path, Icon, title }) => {
          const active = pathname === path || pathname?.startsWith(path + '/');
          const badge = key === 'my-assignments' && assignmentBadge > 0 ? assignmentBadge : 0;
          return (
            <button key={key} onClick={() => router.push(path)} title={title}
              className={`relative p-2 rounded-md text-white transition-colors shrink-0 ${active ? 'bg-sky-600 shadow-inner' : 'hover:bg-sky-600'}`}>
              <Icon size={22} />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="hidden md:block md:flex-1" />
        {/* Tema + salir: solo en la columna de escritorio (en móvil viven en el cluster fijo de arriba) */}
        <button onClick={() => setMode(isDark ? 'light' : 'dark')} title="Tema"
          className="hidden md:block p-2 rounded-md text-white hover:bg-sky-600 transition-colors shrink-0">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={logout} title="Cerrar sesión"
          className="hidden md:block p-2 rounded-md text-white hover:bg-red-600 transition-colors shrink-0">
          <LogOut size={20} />
        </button>
      </div>
    </>
  );
}
