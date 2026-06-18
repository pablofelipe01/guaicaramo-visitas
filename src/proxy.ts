import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

/**
 * Proxy (antes "middleware" — renombrado en Next.js 16).
 *
 * Sliding session: si hay una sesión activa, renueva la expiración de la cookie
 * en cada request mientras el usuario esté activo. Esto evita que la sesión
 * caduque a mitad de turno con la pestaña abierta, que era la causa de que el
 * registro de visitante se creara sin quedar vinculado al administrador.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = request.cookies.get(SESSION_COOKIE);

  if (session?.value) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: session.value,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  // Correr en todas las rutas salvo assets estáticos y /api
  // (/api/logout maneja su propia cookie y no debe renovarla).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)'],
};
