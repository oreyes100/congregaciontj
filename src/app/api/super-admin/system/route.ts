import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import fs from 'fs';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    let memTotal = 0, memAvailable = 0;
    if (fs.existsSync('/proc/meminfo')) {
      const mi = fs.readFileSync('/proc/meminfo', 'utf8');
      memTotal = Number(/MemTotal:\s+(\d+)/.exec(mi)?.[1] ?? 0);
      memAvailable = Number(/MemAvailable:\s+(\d+)/.exec(mi)?.[1] ?? 0);
    } else {
      const os = await import('os');
      memTotal = Math.round(os.totalmem() / 1024);
      memAvailable = Math.round(os.freemem() / 1024);
    }

    const loadavg: number[] = fs.existsSync('/proc/loadavg')
      ? fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).map(Number)
      : (await import('os')).loadavg();

    // df -kP: POSIX format avoids wrapped lines on long device names
    const dfOut = execSync('df -kP / | tail -1', { timeout: 5000 }).toString().trim().split(/\s+/);
    const diskTotalKb = Number(dfOut[1]);
    const diskUsedKb = Number(dfOut[2]);

    const dbPath = process.env.DB_PATH || '';
    const dbBytes = dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    let lastBackup: string | null = null;
    try {
      const lb = execSync('ls -t /opt/msp/backups/msp-*.db* 2>/dev/null | head -1', { timeout: 5000 })
        .toString().trim();
      lastBackup = lb || null;
    } catch { /* dev environment: no backups dir */ }

    return NextResponse.json({
      ts: Date.now(),
      mem: {
        totalKb: memTotal,
        availableKb: memAvailable,
        usedPct: memTotal ? Math.round((1 - memAvailable / memTotal) * 100) : 0,
      },
      disk: {
        totalKb: diskTotalKb,
        usedKb: diskUsedKb,
        usedPct: diskTotalKb ? Math.round((diskUsedKb / diskTotalKb) * 100) : 0,
      },
      load: loadavg,
      dbBytes,
      lastBackup,
      uptimeSec: Math.floor(process.uptime()),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
