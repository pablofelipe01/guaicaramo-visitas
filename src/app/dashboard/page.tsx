import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getRegistros } from '@/lib/airtable';
import RegistrosPanel from './RegistrosPanel';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('g-session')?.value;

  if (!raw) redirect('/login');

  let usuario = 'Administrador';
  try {
    const session = JSON.parse(raw) as { usuario: string };
    usuario = session.usuario ?? 'Administrador';
  } catch {
    redirect('/login');
  }

  const registros = await getRegistros();

  const total      = registros.length;
  const pendientes = registros.filter((r) => r.status === 'PENDIENTE').length;
  const aprobados  = registros.filter((r) => r.status === 'APROBADO').length;
  const negados    = registros.filter((r) => r.status === 'NEGADO').length;

  return (
    <div className="db-shell">
      {/* Top bar */}
      <header className="db-topbar">
        <div className="db-topbar-brand">
          <Image
            src="/logo-guaicaramo.png"
            alt="Guaicaramo"
            height={36}
            width={160}
            style={{ height: 36, width: 'auto', objectFit: 'contain', objectPosition: 'left' }}
            priority
          />
        </div>
        <div className="db-topbar-right">
          <span className="db-topbar-user">{usuario}</span>
          <form action="/api/logout" method="POST">
            <button type="submit" className="btn btn-ghost btn-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      {/* Main */}
      <main className="db-main">
        {/* Stats */}
        <div className="db-stats">
          <div className="db-stat-card">
            <span className="db-stat-label">Total registros</span>
            <span className="db-stat-value">{total}</span>
          </div>
          <div className="db-stat-card stat-pendiente">
            <span className="db-stat-label">Pendientes</span>
            <span className="db-stat-value">{pendientes}</span>
          </div>
          <div className="db-stat-card stat-aprobado">
            <span className="db-stat-label">Aprobados</span>
            <span className="db-stat-value">{aprobados}</span>
          </div>
          <div className="db-stat-card stat-negado">
            <span className="db-stat-label">Negados</span>
            <span className="db-stat-value">{negados}</span>
          </div>
        </div>

        {/* Records panel */}
        <RegistrosPanel registros={registros} usuario={usuario} />
      </main>
    </div>
  );
}
