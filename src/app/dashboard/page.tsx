import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getRegistros, getPlacas, getPersonas } from '@/lib/airtable';
import RegistrarVisitantePanel from './RegistrarVisitantePanel';
import DashboardContent from './DashboardContent';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('g-session')?.value;

  if (!raw) redirect('/login');

  let usuario = 'Administrador';
  let tipo = 'Invita';
  try {
    const session = JSON.parse(raw) as { usuario: string; tipo?: string };
    usuario = session.usuario ?? 'Administrador';
    tipo = session.tipo ?? 'Invita';
  } catch {
    redirect('/login');
  }

  const isAutoriza = tipo === 'Autoriza';

  // Solo carga datos si el usuario puede autorizarlos
  const [registros, placas, personas] = isAutoriza
    ? await Promise.all([getRegistros(), getPlacas(), getPersonas()])
    : [[], [], []];
  const stats = {
    total:      registros.length,
    pendientes: registros.filter((r) => r.status === 'PENDIENTE').length,
    aprobados:  registros.filter((r) => r.status === 'APROBADO').length,
    negados:    registros.filter((r) => r.status === 'NEGADO').length,
  };

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
        {isAutoriza ? (
          <DashboardContent
            registros={registros}
            placas={placas}
            personas={personas}
            usuario={usuario}
            tipo={tipo}
            stats={stats}
          />
        ) : (
          <RegistrarVisitantePanel />
        )}
      </main>
    </div>
  );
}
