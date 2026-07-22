import { NextResponse } from 'next/server';
import { deleteEntry } from '@/lib/store';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = await params;
  const sites = await deleteEntry(user.id, companyId);
  return NextResponse.json({ success: true, sites });
}
