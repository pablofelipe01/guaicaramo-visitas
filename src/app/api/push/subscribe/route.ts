import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import { updateAdminPushSubscription } from '@/lib/airtable';
import { getVapidPublicKey } from '@/lib/webpush';

async function getAdminFromSession(): Promise<{ id: string; tipo: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string; tipo?: string };
    if (!parsed.id) return null;
    return { id: parsed.id, tipo: parsed.tipo ?? 'Invita' };
  } catch {
    return null;
  }
}

// GET — devuelve la clave pública VAPID para que el cliente registre el Service Worker
export async function GET(): Promise<Response> {
  try {
    const publicKey = getVapidPublicKey();
    return Response.json({ publicKey });
  } catch {
    return Response.json({ error: 'Push no configurado en el servidor' }, { status: 503 });
  }
}

// POST — guarda la PushSubscription del admin autenticado en Airtable
export async function POST(request: NextRequest): Promise<Response> {
  const admin = await getAdminFromSession();
  if (!admin) return Response.json({ error: 'No autorizado' }, { status: 401 });

  if (admin.tipo !== 'Autoriza' && admin.tipo !== 'Superadmin') {
    return Response.json(
      { error: 'Solo los roles Autoriza y Superadmin reciben notificaciones push' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // body es el objeto PushSubscription que devuelve el browser
  const subscriptionJson = JSON.stringify(body);
  const ok = await updateAdminPushSubscription(admin.id, subscriptionJson);
  if (!ok) return Response.json({ error: 'Error al guardar la suscripción' }, { status: 500 });

  return Response.json({ ok: true });
}

// DELETE — elimina la suscripción (el admin se desuscribe de las notificaciones)
export async function DELETE(): Promise<Response> {
  const admin = await getAdminFromSession();
  if (!admin) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const ok = await updateAdminPushSubscription(admin.id, null);
  if (!ok) return Response.json({ error: 'Error al eliminar la suscripción' }, { status: 500 });

  return Response.json({ ok: true });
}
