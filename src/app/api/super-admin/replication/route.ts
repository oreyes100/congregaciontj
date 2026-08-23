import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const localSha = execSync('git -C /opt/msp rev-parse HEAD', { timeout: 8000 })
      .toString().trim();

    let remoteSha: string | null = null;
    try {
      const lsOut = execSync(
        'git -C /opt/msp ls-remote origin refs/heads/main',
        { timeout: 10000 }
      ).toString().trim();
      remoteSha = lsOut.split(/\s+/)[0] || null;
    } catch {
      // No credentials or no network — non-fatal
    }

    return NextResponse.json({
      localSha,
      remoteSha,
      inSync: remoteSha ? localSha === remoteSha : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
