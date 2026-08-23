import { updateRow, deleteRow } from "@/lib/crud";
import { getSessionContext, unauthenticated } from "@/lib/serverContext";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  const cid = ctx.congreId && !ctx.isSuperAdmin ? ctx.congreId : undefined;
  const { id } = await params;
  return updateRow("circuit_overseer_visits", id, await request.json(), cid);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  const cid = ctx.congreId && !ctx.isSuperAdmin ? ctx.congreId : undefined;
  const { id } = await params;
  return deleteRow("circuit_overseer_visits", id, cid);
}
