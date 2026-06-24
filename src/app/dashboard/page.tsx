import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getRegistros, getPlacas, getPersonas, getAdmins, getItems, getFinDeSemana, getAdminsAll, type RegistroRecord, type PlacaRecord, type PersonaRecord, type ItemRecord, type FinDeSemanaRecord, type AdminFullRecord } from '@/lib/airtable';
import RegistrarVisitantePanel from './RegistrarVisitantePanel';
import DashboardContent from './DashboardContent';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) redirect('/login');

  let usuario = 'Administrador';
  let tipo = 'Invita';
  let areas: string[] = [];
  try {
    const session = JSON.parse(raw) as { usuario: string; tipo?: string; areas?: string[] };
    usuario = session.usuario ?? 'Administrador';
    tipo = session.tipo ?? 'Invita';
    areas = session.areas ?? [];
  } catch {
    redirect('/login');
  }

  const isAutoriza   = tipo === 'Autoriza';
  const isSuperadmin = tipo === 'Superadmin';
  const isPorteria   = tipo === 'Porteria';
  const canViewDashboard = isAutoriza || isSuperadmin || isPorteria;

  // Solo carga datos si el usuario puede ver el dashboard
  let placas: PlacaRecord[] = [], personas: PersonaRecord[] = [], registros: RegistroRecord[] = [], items: ItemRecord[] = [];
  let finDeSemana: FinDeSemanaRecord[] = [], admins: AdminFullRecord[] = [];
  if (canViewDashboard) {
    [registros, placas, personas] = await Promise.all([getRegistros(), getPlacas(), getPersonas()]);

    if (isSuperadmin) {
      try {
        [items, finDeSemana, admins] = await Promise.all([getItems(), getFinDeSemana(), getAdminsAll()]);
      } catch {
        // tables may not be configured yet — panel will show empty lists
      }
    }

    // Superadmin ve todo sin filtro de área
    // Filtrar por área: solo para Autoriza
    if (isAutoriza && areas.length > 0) {
      const allAdmins = await getAdmins();
      const matchingAdminIds = new Set(
        allAdmins
          .filter(a => a.areas.some(area => areas.includes(area)))
          .map(a => a.id),
      );
      placas = placas.filter(p =>
        !p.adminIds?.length || p.adminIds.some(id => matchingAdminIds.has(id)),
      );
      personas = personas.filter(p =>
        !p.adminIds?.length || p.adminIds.some(id => matchingAdminIds.has(id)),
      );
      // Filtrar registros: solo los vinculados a placas o personas del área
      const filteredPlacaIds = new Set(placas.map(p => p.id));
      const filteredPersonaIds = new Set(personas.map(p => p.id));
      registros = registros.filter(r => {
        if (!r.placaIds?.length && !r.personaIds?.length) return true;
        if (r.placaIds?.some(id => filteredPlacaIds.has(id))) return true;
        if (r.personaIds?.some(id => filteredPersonaIds.has(id))) return true;
        return false;
      });
    }
  }
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
        {canViewDashboard ? (
          <DashboardContent
            registros={registros}
            placas={placas}
            personas={personas}
            usuario={usuario}
            tipo={tipo}
            stats={stats}
            items={items}
            finDeSemana={finDeSemana}
            admins={admins}
          />
        ) : (
          <RegistrarVisitantePanel />
        )}
      </main>
    </div>
  );
}
