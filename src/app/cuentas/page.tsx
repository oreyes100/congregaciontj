'use client';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

export default function CuentasPage() {
  return (
    <div className="flex h-screen">
      <IconSidebar />
      <SyncStatus />
      <div className="flex-1 overflow-hidden pb-[52px] md:pb-0">
        <iframe
          src="https://cuentas-congregacion-bay.vercel.app/"
          className="w-full h-full border-0"
          title="Cuentas de la Congregación"
        />
      </div>
    </div>
  );
}
