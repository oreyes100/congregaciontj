'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageCircle, Save, Send, Loader2, CheckCircle2, AlertTriangle, KeyRound, Info,
} from 'lucide-react';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

interface Settings {
  whatsapp_enabled: number;
  provider: string;
  phone_number_id: string | null;
  sender_label: string | null;
  has_access_token: boolean;
  notify_on_assign: number;
  notify_overdue: number;
  overdue_days: number;
  notify_weekly_status: number;
  weekly_status_dow: number;
  template_assign: string | null;
  template_overdue: string | null;
  template_weekly: string | null;
}

const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const VARS = [
  ['{{nombre}}', 'Nombre del publicador'],
  ['{{territorio}}', 'Número y nombre del territorio'],
  ['{{fecha}}', 'Fecha de asignación'],
  ['{{dias}}', 'Días transcurridos'],
  ['{{parejas}}', 'Parejas asignadas'],
];

export default function MessagingPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/messaging-settings');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setS(json.settings);
      setDefaults(json.defaults || {});
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
      delete body.has_access_token;
      if (token) body.access_token = token;
      const res = await fetch('/api/messaging-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar');
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

  const runNow = async () => {
    setRunning(true); setRunResult(null);
    try {
      const res = await fetch('/api/territory-notifications/run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setRunResult(`Enviados: ${json.overdueSent} recordatorio(s) de vencimiento, ${json.weeklySent} solicitud(es) de avance.`);
    } catch (e) {
      setRunResult(e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  };

  const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative ${on ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-gray-600'}`}
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
        <div className="bg-gradient-to-r from-green-600 to-green-800 dark:from-green-800 dark:to-green-950 text-white px-4 py-2.5 shrink-0 flex items-center gap-2">
          <MessageCircle size={18} />
          <h1 className="font-bold text-base sm:text-lg">Mensajería y WhatsApp</h1>
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
                {/* ── Conexión ─────────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
                  <h2 className="font-semibold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                    <KeyRound size={15} className="text-green-600" /> Conexión de WhatsApp
                  </h2>

                  <Toggle
                    on={!!s.whatsapp_enabled}
                    onChange={v => set('whatsapp_enabled', v ? 1 : 0)}
                    label="Enviar mensajes por WhatsApp"
                    hint="Si está apagado, los avisos sólo aparecen dentro de la plataforma."
                  />

                  <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-[11px] text-sky-800 dark:text-sky-300 flex gap-2">
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      Usa la <strong>WhatsApp Cloud API</strong> de Meta. Necesitas el <em>Phone number ID</em> y un
                      <em> access token</em> permanente desde tu app en <code>developers.facebook.com</code>.
                      Sólo se envía a publicadores que tengan teléfono en su perfil.
                    </span>
                  </div>

                  <label className="block text-[11px] text-slate-500 dark:text-gray-400">
                    Phone number ID
                    <input
                      value={s.phone_number_id ?? ''}
                      onChange={e => set('phone_number_id', e.target.value)}
                      placeholder="Ej. 123456789012345"
                      className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-gray-400">
                    Access token {s.has_access_token && <span className="text-emerald-600">— hay un token guardado</span>}
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder={s.has_access_token ? 'Déjalo vacío para conservar el actual' : 'Pega aquí el token'}
                      className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-gray-400">
                    Nombre que aparece al inicio del mensaje
                    <input
                      value={s.sender_label ?? ''}
                      onChange={e => set('sender_label', e.target.value)}
                      placeholder="Ej. Congregación Tejalpa"
                      className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-900"
                    />
                  </label>
                </section>

                {/* ── Avisos ───────────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-1">
                  <h2 className="font-semibold text-slate-800 dark:text-gray-100 mb-2">Avisos de territorios</h2>

                  <Toggle
                    on={!!s.notify_on_assign}
                    onChange={v => set('notify_on_assign', v ? 1 : 0)}
                    label="Al asignar un territorio"
                    hint="Incluye el mapa del territorio y la fecha de inicio."
                  />

                  <Toggle
                    on={!!s.notify_overdue}
                    onChange={v => set('notify_overdue', v ? 1 : 0)}
                    label="Si no se completa a tiempo"
                  />
                  {!!s.notify_overdue && (
                    <label className="flex items-center gap-2 pl-12 pb-2 text-[11px] text-slate-500 dark:text-gray-400">
                      Avisar después de
                      <input
                        type="number" min={1} max={90}
                        value={s.overdue_days}
                        onChange={e => set('overdue_days', Number(e.target.value))}
                        className="w-16 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900"
                      />
                      días
                    </label>
                  )}

                  <Toggle
                    on={!!s.notify_weekly_status}
                    onChange={v => set('notify_weekly_status', v ? 1 : 0)}
                    label="Solicitud semanal de avance"
                  />
                  {!!s.notify_weekly_status && (
                    <label className="flex items-center gap-2 pl-12 pb-2 text-[11px] text-slate-500 dark:text-gray-400">
                      Cada
                      <select
                        value={s.weekly_status_dow}
                        onChange={e => set('weekly_status_dow', Number(e.target.value))}
                        className="border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900"
                      >
                        {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </label>
                  )}
                </section>

                {/* ── Plantillas ───────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
                  <h2 className="font-semibold text-slate-800 dark:text-gray-100">Plantillas de mensaje</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {VARS.map(([v, d]) => (
                      <span key={v} title={d}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                        {v}
                      </span>
                    ))}
                  </div>

                  {([
                    ['template_assign', 'Al asignar', 'assign'],
                    ['template_overdue', 'Territorio vencido', 'overdue'],
                    ['template_weekly', 'Avance semanal', 'weekly'],
                  ] as const).map(([key, label, defKey]) => (
                    <label key={key} className="block text-[11px] text-slate-500 dark:text-gray-400">
                      {label}
                      <textarea
                        rows={3}
                        value={s[key] ?? ''}
                        onChange={e => set(key, e.target.value)}
                        placeholder={defaults[defKey] || ''}
                        className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-900 resize-y"
                      />
                    </label>
                  ))}
                </section>

                {/* ── Acciones ─────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2 pb-6">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar configuración
                  </button>

                  <button
                    onClick={runNow}
                    disabled={running}
                    title="Revisa ahora los territorios vencidos y envía los avisos pendientes"
                    className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    {running ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Ejecutar avisos ahora
                  </button>

                  {saved && (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs">
                      <CheckCircle2 size={14} /> Guardado
                    </span>
                  )}
                  {runResult && <span className="text-xs text-slate-500 dark:text-gray-400">{runResult}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
