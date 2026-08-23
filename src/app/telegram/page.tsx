'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send, Save, Loader2, CheckCircle2, AlertTriangle, KeyRound, Info, Bot } from 'lucide-react';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

interface Settings {
  telegram_enabled: number;
  telegram_chat_id: string | null;
  has_bot_token: boolean;
  telegram_notify_on_assign: number;
  telegram_notify_overdue: number;
  telegram_notify_weekly_status: number;
  telegram_weekly_dow: number;
}

const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function TelegramPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram-settings');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setS(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS(prev => (prev ? { ...prev, [k]: v } : prev));

  const save = async () => {
    if (!s) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      const body: Record<string, unknown> = { ...s };
      delete body.has_bot_token;
      if (token) body.telegram_bot_token = token;
      const res = await fetch('/api/telegram-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      setToken('');
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/telegram-settings/test', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setTestResult({ ok: true, msg: 'Mensaje de prueba enviado correctamente.' });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Error' });
    } finally {
      setTesting(false);
    }
  };

  const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative ${on ? 'bg-blue-500' : 'bg-slate-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-slate-800 dark:text-gray-100">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500 dark:text-gray-400">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-900 dark:text-gray-100 text-sm pb-[52px] md:pb-0">
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 dark:from-blue-700 dark:to-blue-950 text-white px-4 py-2.5 shrink-0 flex items-center gap-2">
          <Bot size={18} />
          <h1 className="font-bold text-base sm:text-lg">Sincronización con Telegram</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="max-w-3xl mx-auto space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {!s ? (
              <p className="text-slate-400 text-center py-10 text-xs">Cargando…</p>
            ) : (
              <>
                {/* ── Conexión ─────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
                  <h2 className="font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                    <KeyRound size={15} className="text-blue-500" /> Conexión del Bot
                  </h2>

                  <Toggle
                    on={!!s.telegram_enabled}
                    onChange={v => set('telegram_enabled', v ? 1 : 0)}
                    label="Activar sincronización con Telegram"
                    hint="Envía avisos de territorios al grupo o canal configurado."
                  />

                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-800 dark:text-blue-300 flex gap-2">
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      Necesitas un <strong>Bot de Telegram</strong>. Créalo con{' '}
                      <strong>@BotFather</strong> en Telegram y obten el token. Luego agrega el bot
                      a tu grupo o canal y obtén el <strong>Chat ID</strong> usando{' '}
                      <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">@userinfobot</code>.
                    </span>
                  </div>

                  <label className="block text-[11px] text-slate-500 dark:text-gray-400">
                    Bot Token {s.has_bot_token && <span className="text-emerald-600">— hay un token guardado</span>}
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder={s.has_bot_token ? 'Déjalo vacío para conservar el actual' : 'Ej. 123456789:ABCdef…'}
                      className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-gray-400">
                    Chat ID (grupo, canal o usuario)
                    <input
                      value={s.telegram_chat_id ?? ''}
                      onChange={e => set('telegram_chat_id', e.target.value)}
                      placeholder="Ej. -1001234567890"
                      className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
                    />
                    <span className="text-[10px] text-slate-400">Los grupos empiezan con -100 y los canales con -100.</span>
                  </label>
                </section>

                {/* ── Avisos ───────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-1">
                  <h2 className="font-semibold text-slate-800 dark:text-gray-100 mb-2">Avisos de territorios al grupo</h2>

                  <Toggle
                    on={!!s.telegram_notify_on_assign}
                    onChange={v => set('telegram_notify_on_assign', v ? 1 : 0)}
                    label="Al asignar un territorio"
                    hint="Publica en el grupo cuando se asigna un territorio."
                  />

                  <Toggle
                    on={!!s.telegram_notify_overdue}
                    onChange={v => set('telegram_notify_overdue', v ? 1 : 0)}
                    label="Si un territorio no se completa a tiempo"
                    hint="Recordatorio al grupo cuando un territorio está vencido."
                  />

                  <Toggle
                    on={!!s.telegram_notify_weekly_status}
                    onChange={v => set('telegram_notify_weekly_status', v ? 1 : 0)}
                    label="Solicitud semanal de avance"
                  />
                  {!!s.telegram_notify_weekly_status && (
                    <label className="flex items-center gap-2 pl-12 pb-2 text-[11px] text-slate-500 dark:text-gray-400">
                      Cada
                      <select
                        value={s.telegram_weekly_dow}
                        onChange={e => set('telegram_weekly_dow', Number(e.target.value))}
                        className="border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900"
                      >
                        {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  )}
                </section>

                {/* ── Acciones ─────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2 pb-6">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar configuración
                  </button>

                  <button
                    onClick={test}
                    disabled={testing || !s.has_bot_token}
                    title={!s.has_bot_token ? 'Guarda el bot token primero' : 'Enviar mensaje de prueba al grupo'}
                    className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Probar conexión
                  </button>

                  {saved && (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs">
                      <CheckCircle2 size={14} /> Guardado
                    </span>
                  )}

                  {testResult && (
                    <span className={`flex items-center gap-1 text-xs ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {testResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {testResult.msg}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
