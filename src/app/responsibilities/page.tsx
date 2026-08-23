'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  UserCog, FileDown, ChevronDown,
  Shield, FileText, BookOpen, Globe, Building2, Settings, Star,
} from 'lucide-react';
import { IconSidebar } from '@/components/IconSidebar';
import { PersonPickerModal } from '@/components/PersonPickerModal';
import { SyncStatus } from '@/components/SyncStatus';

interface RolePerson { id: string; first_name?: string | null; last_name?: string | null; display_name?: string | null }
interface Role {
  role_key: string;
  label: string;
  category: string;
  sub_label: string | null;
  custom_label: string | null;
  person: RolePerson | null;
  assistant_1: RolePerson | null;
  assistant_2: RolePerson | null;
}

type Slot = { roleKey: string; field: 'person_id' | 'assistant_1_id' | 'assistant_2_id' };

function personName(p: RolePerson | null | undefined): string {
  if (!p) return '';
  return p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

const CATEGORIES: { key: string; icon: React.ReactNode; color: string; headerBg: string; headerText: string }[] = [
  { key: 'Cuerpo de Ancianos',       icon: <Shield size={15} />,    color: 'border-violet-200 dark:border-violet-800',   headerBg: 'bg-violet-600',  headerText: 'text-white' },
  { key: 'Secretaría',               icon: <FileText size={15} />,  color: 'border-teal-200 dark:border-teal-800',       headerBg: 'bg-teal-600',    headerText: 'text-white' },
  { key: 'Vida y Ministerio Cristiano', icon: <BookOpen size={15} />, color: 'border-blue-200 dark:border-blue-800',     headerBg: 'bg-blue-600',    headerText: 'text-white' },
  { key: 'Servicio de Campo',        icon: <Globe size={15} />,     color: 'border-emerald-200 dark:border-emerald-800', headerBg: 'bg-emerald-600', headerText: 'text-white' },
  { key: 'Reuniones y Salón',        icon: <Building2 size={15} />, color: 'border-amber-200 dark:border-amber-800',    headerBg: 'bg-amber-500',   headerText: 'text-white' },
  { key: 'Administración',           icon: <Settings size={15} />,  color: 'border-slate-200 dark:border-slate-700',     headerBg: 'bg-slate-600',   headerText: 'text-white' },
  { key: 'Otros',                    icon: <Star size={15} />,      color: 'border-pink-200 dark:border-pink-800',       headerBg: 'bg-pink-600',    headerText: 'text-white' },
];

function PersonSlot({ person, label, onClick }: { person: RolePerson | null; label?: string; onClick: () => void }) {
  const name = personName(person);
  return (
    <div className="flex-1 min-w-0">
      <button
        onClick={onClick}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors
          ${name
            ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:border-blue-400'
            : 'bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 italic'
          }`}
      >
        {name || '— Sin asignar —'}
      </button>
      {label && <p className="text-[10px] text-gray-400 text-center mt-0.5">{label}</p>}
    </div>
  );
}

async function exportOrgPdf(roles: Role[], congregationName: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(55, 65, 200);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTRUCTURA DE LA CONGREGACIÓN', pageW / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Privilegios y Responsabilidades', pageW / 2, 19, { align: 'center' });
  doc.setFontSize(8);
  doc.text(congregationName, pageW / 2, 25, { align: 'center' });

  const categoryColors: Record<string, [number, number, number]> = {
    'Cuerpo de Ancianos':          [109, 40, 217],
    'Secretaría':                  [13, 148, 136],
    'Vida y Ministerio Cristiano': [37, 99, 235],
    'Servicio de Campo':           [5, 150, 105],
    'Reuniones y Salón':           [245, 158, 11],
    'Administración':              [71, 85, 105],
    'Otros':                       [219, 39, 119],
  };

  const grouped: Record<string, Role[]> = {};
  for (const r of roles) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  let y = 34;

  for (const cat of CATEGORIES) {
    const catRoles = grouped[cat.key];
    if (!catRoles || catRoles.length === 0) continue;

    const [cr, cg, cb] = categoryColors[cat.key] || [100, 100, 100];

    const body = catRoles.map(r => {
      const label = r.role_key === 'custom' ? (r.custom_label || r.label) : r.label;
      const sub = r.sub_label ? ` (${r.sub_label})` : '';
      const main = personName(r.person) || '—';
      const a1 = personName(r.assistant_1) || '';
      const a2 = personName(r.assistant_2) || '';
      const helpers = [a1, a2].filter(Boolean).join(', ');
      return [label + sub, main, helpers || '—'];
    });

    autoTable(doc, {
      head: [[{ content: cat.key, colSpan: 3 }], ['Responsabilidad', 'Asignado a', 'Ayudantes']],
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.2, lineColor: [200, 200, 210] as [number,number,number] },
      headStyles: { fillColor: [245, 245, 250] as [number,number,number], textColor: [60, 60, 80] as [number,number,number], fontStyle: 'bold', fontSize: 7.5 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (data: any) => {
        if (data.section === 'head' && data.row.index === 0) {
          data.cell.styles.fillColor = [cr, cg, cb];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
          data.cell.styles.halign = 'left';
        }
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 55 },
        2: { cellWidth: 55 },
      },
      alternateRowStyles: { fillColor: [250, 250, 255] as [number,number,number] },
      margin: { left: 10, right: 10 },
      didDrawPage: () => { y = 20; },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 160);
    doc.text(`Ver Ws 15 de Abril de 2015 págs. 3-13`, 10, ph - 8);
    doc.text(`Pág. ${i} / ${totalPages}`, pageW - 10, ph - 8, { align: 'right' });
    doc.text(new Date().toLocaleDateString('es-MX'), pageW / 2, ph - 8, { align: 'center' });
  }

  doc.save(`Responsabilidades_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function ResponsibilitiesPage() {
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [persons, setPersons] = useState<RolePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch('/api/congregation-roles'),
        fetch('/api/users'),
      ]);
      const rData = await rRes.json();
      const pData = await pRes.json();
      const map: Record<string, Role> = {};
      for (const r of rData.roles || []) map[r.role_key] = r;
      setRoles(map);
      setCustomLabel(map.custom?.custom_label || '');
      setPersons(pData.users || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const assign = async (roleKey: string, field: Slot['field'], personId: string | null) => {
    setRoles(prev => {
      const r = prev[roleKey];
      if (!r) return prev;
      const key = field === 'person_id' ? 'person' : field === 'assistant_1_id' ? 'assistant_1' : 'assistant_2';
      const p = persons.find(x => x.id === personId) || null;
      return { ...prev, [roleKey]: { ...r, [key]: p } };
    });
    try {
      await fetch('/api/congregation-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_key: roleKey, [field]: personId }),
      });
    } catch { /* ignore */ }
  };

  const saveCustomLabel = async () => {
    try {
      await fetch('/api/congregation-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_key: 'custom', custom_label: customLabel || null }),
      });
    } catch { /* ignore */ }
  };

  const handleExport = async (format: 'pdf') => {
    setExportOpen(false);
    setExporting(true);
    try {
      const allRoles = Object.values(roles);
      await exportOrgPdf(allRoles, 'Congregación');
    } catch (e) {
      alert('Error al exportar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  };

  const grouped: Record<string, Role[]> = {};
  for (const r of Object.values(roles)) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-700 to-blue-700 text-white px-4 py-2 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog size={18} />
            <h1 className="font-bold text-lg">Responsabilidades en la Congregación</h1>
          </div>
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={exporting || loading}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileDown size={15} />
              {exporting ? 'Generando…' : 'Exportar'}
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[160px]">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Reporte Organigrama</p>
                <button onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <FileDown size={14} /> PDF Profesional
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
        ) : (
          <div
            className="flex-1 overflow-auto p-4 pb-[52px] md:pb-4"
            onClick={() => exportOpen && setExportOpen(false)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
              {CATEGORIES.map(cat => {
                const catRoles = grouped[cat.key] || [];
                if (catRoles.length === 0) return null;

                return (
                  <div key={cat.key} className={`rounded-xl border overflow-hidden shadow-sm ${cat.color}`}>
                    {/* Category header */}
                    <div className={`${cat.headerBg} ${cat.headerText} px-3 py-2 flex items-center gap-2`}>
                      {cat.icon}
                      <span className="font-bold text-sm">{cat.key}</span>
                    </div>

                    {/* Roles */}
                    <div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                      {catRoles.map(role => {
                        const isCustom = role.role_key === 'custom';
                        const displayLabel = isCustom ? (role.custom_label || role.label) : role.label;

                        return (
                          <div key={role.role_key} className="px-3 py-2.5 space-y-1.5">
                            {/* Role label */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1">
                                {isCustom ? (
                                  <input
                                    className="w-full bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 text-xs font-semibold focus:outline-none focus:border-blue-400"
                                    placeholder="Nombre de la responsabilidad"
                                    value={customLabel}
                                    onChange={e => setCustomLabel(e.target.value)}
                                    onBlur={saveCustomLabel}
                                  />
                                ) : displayLabel}
                              </span>
                              {role.sub_label && (
                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">
                                  {role.sub_label}
                                </span>
                              )}
                            </div>

                            {/* Person slots */}
                            <div className="flex gap-1.5">
                              <PersonSlot
                                person={role.person}
                                onClick={() => setOpenSlot({ roleKey: role.role_key, field: 'person_id' })}
                              />
                              {(role.assistant_1 !== undefined) && (
                                <>
                                  <PersonSlot
                                    person={role.assistant_1}
                                    label="(Ayudante)"
                                    onClick={() => setOpenSlot({ roleKey: role.role_key, field: 'assistant_1_id' })}
                                  />
                                  <PersonSlot
                                    person={role.assistant_2}
                                    label="(Ayudante)"
                                    onClick={() => setOpenSlot({ roleKey: role.role_key, field: 'assistant_2_id' })}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {openSlot && (
        <PersonPickerModal
          title={roles[openSlot.roleKey]?.label || ''}
          persons={persons}
          selectedId={
            openSlot.field === 'person_id' ? roles[openSlot.roleKey]?.person?.id
              : openSlot.field === 'assistant_1_id' ? roles[openSlot.roleKey]?.assistant_1?.id
              : roles[openSlot.roleKey]?.assistant_2?.id
          }
          onSelect={id => assign(openSlot.roleKey, openSlot.field, id)}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
