'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({ mode: 'system', setMode: () => {} });

function apply(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && system);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
    setModeState(stored);
    apply(stored);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if ((localStorage.getItem('theme') || 'system') === 'system') apply('system'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('theme', m);
    apply(m);
  }, []);

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/**
 * Resolves the theme to the boolean actually in effect, tracking the `dark`
 * class on <html>. Needed wherever a real value is required instead of a
 * Tailwind `dark:` variant — e.g. styling third-party embedded content — and
 * correct for mode='system', where `mode` alone does not tell you the answer.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains('dark'));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// Inline script to set the class before paint (avoids flash of wrong theme)
export const themeInitScript = `(function(){try{var m=localStorage.getItem('theme')||'system';var s=window.matchMedia('(prefers-color-scheme: dark)').matches;if(m==='dark'||(m==='system'&&s))document.documentElement.classList.add('dark');}catch(e){}})();`;
