/**
 * Ingresos de gerentes — filtros de periodo y generación del informe PDF.
 * Sólo se usa en el cliente (jsPDF se carga bajo demanda al descargar).
 */

import type { IngresoGerenteRecord } from '@/lib/airtable';

/* ─────────────────────────────────────────────────────────────
   Periodos de fecha
   ───────────────────────────────────────────────────────── */

export type Periodo =
  | 'todo' | 'hoy' | 'ayer' | 'semana' | 'semana_pasada' | '7dias'
  | 'mes' | 'mes_pasado' | '30dias' | 'anio' | 'personalizado';

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'todo',          label: 'Todo el historial' },
  { value: 'hoy',           label: 'Hoy' },
  { value: 'ayer',          label: 'Ayer' },
  { value: 'semana',        label: 'Esta semana' },
  { value: 'semana_pasada', label: 'Semana pasada' },
  { value: '7dias',         label: 'Últimos 7 días' },
  { value: 'mes',           label: 'Este mes' },
  { value: 'mes_pasado',    label: 'Mes pasado' },
  { value: '30dias',        label: 'Últimos 30 días' },
  { value: 'anio',          label: 'Este año' },
  { value: 'personalizado', label: 'Rango personalizado' },
];

/** Rango de fechas: `desde` inclusivo, `hasta` exclusivo. Sin límite si falta. */
export interface Rango {
  desde?: Date;
  hasta?: Date;
}

function inicioDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sumarDias(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Convierte "YYYY-MM-DD" (valor de <input type="date">) a fecha local. */
function parseFechaInput(s: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function calcularRango(periodo: Periodo, desde = '', hasta = '', ahora = new Date()): Rango {
  const hoy = inicioDia(ahora);
  // Semana de lunes a domingo
  const lunes = sumarDias(hoy, -((hoy.getDay() + 6) % 7));

  switch (periodo) {
    case 'hoy':           return { desde: hoy, hasta: sumarDias(hoy, 1) };
    case 'ayer':          return { desde: sumarDias(hoy, -1), hasta: hoy };
    case 'semana':        return { desde: lunes, hasta: sumarDias(lunes, 7) };
    case 'semana_pasada': return { desde: sumarDias(lunes, -7), hasta: lunes };
    case '7dias':         return { desde: sumarDias(hoy, -6), hasta: sumarDias(hoy, 1) };
    case '30dias':        return { desde: sumarDias(hoy, -29), hasta: sumarDias(hoy, 1) };
    case 'mes':           return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) };
    case 'mes_pasado':    return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 1) };
    case 'anio':          return { desde: new Date(hoy.getFullYear(), 0, 1), hasta: new Date(hoy.getFullYear() + 1, 0, 1) };
    case 'personalizado': {
      const d = parseFechaInput(desde);
      const h = parseFechaInput(hasta);
      return { desde: d, hasta: h ? sumarDias(h, 1) : undefined };
    }
    default:              return {};
  }
}

export function enRango(iso: string | undefined, rango: Rango): boolean {
  if (!rango.desde && !rango.hasta) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (rango.desde && t < rango.desde.getTime()) return false;
  if (rango.hasta && t >= rango.hasta.getTime()) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   Formato
   ───────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');

export function formatFecha(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatFechaHora(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatFecha(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minutos entre ingreso y salida, o null si no aplica. */
export function minutosEstadia(r: IngresoGerenteRecord): number | null {
  if (!r.fecha_hora_ingreso || !r.fecha_hora_salida) return null;
  const min = Math.round((new Date(r.fecha_hora_salida).getTime() - new Date(r.fecha_hora_ingreso).getTime()) / 60000);
  return Number.isFinite(min) && min >= 0 ? min : null;
}

/** Duración legible (ej. "1 h 25 min"). */
export function formatMinutos(min: number | null) {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

export function promedioMinutos(rs: IngresoGerenteRecord[]): number | null {
  const mins = rs.map(minutosEstadia).filter((m): m is number => m !== null);
  return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
}

/** Texto legible del rango, ej. "01/10/2026 – 21/10/2026". */
export function describirRango(rango: Rango): string {
  if (!rango.desde && !rango.hasta) return 'Todo el historial';
  const desde = rango.desde ? formatFecha(rango.desde) : 'el inicio';
  const hasta = rango.hasta ? formatFecha(sumarDias(rango.hasta, -1)) : 'hoy';
  return desde === hasta ? desde : `${desde} – ${hasta}`;
}

/* ─────────────────────────────────────────────────────────────
   PDF
   ───────────────────────────────────────────────────────── */

export interface InformeOpciones {
  ingresos: IngresoGerenteRecord[];
  periodoLabel: string;
  rango: Rango;
  /** Otros filtros aplicados (estado, UEA, búsqueda) para dejarlos en el informe. */
  filtros: string[];
  usuario: string;
}

const VERDE_OSCURO: [number, number, number] = [78, 91, 49];
const VERDE_SUAVE:  [number, number, number] = [238, 244, 227];
const TINTA:        [number, number, number] = [28, 33, 18];
const TINTA_3:      [number, number, number] = [110, 117, 98];

/**
 * Las fuentes estándar de jsPDF sólo cubren Latin-1 (más algo de puntuación);
 * se normalizan espacios especiales y se descartan emojis u otros símbolos.
 */
function limpiar(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/[    ]/g, ' ')
    .replace(/[^\n\x20-\xFF–—‘’“”…€]/g, '')
    .trim();
}

async function cargarLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch('/logo-guaicaramo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = new Image();
    img.src = data;
    await img.decode();
    return { data, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

export async function generarInformePdf(op: InformeOpciones): Promise<void> {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    cargarLogo(),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const generado = new Date();

  // ── Encabezado ──
  let y = M;
  if (logo) {
    const h = 12;
    const w = Math.min((logo.w / logo.h) * h, 60);
    doc.addImage(logo.data, 'PNG', M, y, w, h);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA_3);
  doc.text(`Generado el ${formatFechaHora(generado.toISOString())}`, pageW - M, y + 4, { align: 'right' });
  doc.text(`Por: ${limpiar(op.usuario)}`, pageW - M, y + 8.5, { align: 'right' });

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...VERDE_OSCURO);
  doc.text('Informe de ingresos de gerentes de unidades externas', M, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  const periodo = op.periodoLabel === 'Todo el historial' || op.periodoLabel === 'Rango personalizado'
    ? describirRango(op.rango)
    : `${op.periodoLabel} (${describirRango(op.rango)})`;
  doc.text(`Periodo: ${periodo}`, M, y);
  if (op.filtros.length) {
    y += 5;
    doc.setTextColor(...TINTA_3);
    doc.text(limpiar(`Filtros: ${op.filtros.join(' · ')}`), M, y);
  }

  // ── Indicadores ──
  y += 6;
  const rs = op.ingresos;
  const indicadores: [string, string][] = [
    ['Total ingresos', String(rs.length)],
    ['En sitio (sin salida)', String(rs.filter(r => !r.fecha_hora_salida).length)],
    ['Gerentes distintos', String(new Set(rs.map(r => r.gerente_id).filter(Boolean)).size)],
    ['Unidades externas', String(new Set(rs.map(r => r.uea).filter(Boolean)).size)],
    ['Estadía promedio', formatMinutos(promedioMinutos(rs))],
  ];
  const gap = 4;
  const boxW = (pageW - 2 * M - gap * (indicadores.length - 1)) / indicadores.length;
  indicadores.forEach(([label, value], i) => {
    const x = M + i * (boxW + gap);
    doc.setFillColor(...VERDE_SUAVE);
    doc.roundedRect(x, y, boxW, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_3);
    doc.text(label.toUpperCase(), x + 4, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...VERDE_OSCURO);
    doc.text(value, x + 4, y + 12.5);
  });
  y += 22;

  const estilosTabla = {
    theme: 'grid' as const,
    rowPageBreak: 'avoid' as const,
    margin: { left: M, right: M, top: M, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: TINTA, lineColor: [220, 224, 212] as [number, number, number], lineWidth: 0.2, overflow: 'linebreak' as const },
    headStyles: { fillColor: VERDE_OSCURO, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [250, 247, 239] as [number, number, number] },
  };

  if (rs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...TINTA_3);
    doc.text('No hay ingresos de gerentes en el periodo y filtros seleccionados.', M, y + 4);
  } else {
    // ── Resumen por UEA ──
    const porUea = new Map<string, IngresoGerenteRecord[]>();
    for (const r of rs) {
      const k = r.uea || 'Sin UEA';
      porUea.set(k, [...(porUea.get(k) ?? []), r]);
    }
    const filasUea = [...porUea.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([uea, lista]) => [
        limpiar(uea),
        String(lista.length),
        String(new Set(lista.map(r => r.gerente_id).filter(Boolean)).size),
        formatMinutos(promedioMinutos(lista)),
        formatFechaHora(lista.map(r => r.fecha_hora_ingreso).filter(Boolean).sort().at(-1)),
      ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...VERDE_OSCURO);
    doc.text('Resumen por unidad externa', M, y);
    autoTable(doc, {
      ...estilosTabla,
      startY: y + 2,
      head: [['Unidad externa (UEA)', 'Ingresos', 'Gerentes', 'Estadía promedio', 'Último ingreso']],
      body: filasUea,
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });

    // ── Detalle ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 9;
    if (y > pageH - 40) { doc.addPage(); y = M + 4; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...VERDE_OSCURO);
    doc.text('Detalle de ingresos', M, y);
    autoTable(doc, {
      ...estilosTabla,
      startY: y + 2,
      head: [['#', 'Ingreso', 'Gerente', 'Cédula', 'UEA', 'Placa', 'Área destino', 'Salida', 'Estadía', 'Nota del vigilante']],
      body: rs.map((r, i) => [
        String(i + 1),
        formatFechaHora(r.fecha_hora_ingreso),
        limpiar(r.nombre) || '—',
        limpiar(r.cedula) || '—',
        limpiar(r.uea) || '—',
        limpiar(r.placa_ingreso) || '—',
        limpiar(r.area_destino) || '—',
        r.fecha_hora_salida ? formatFechaHora(r.fecha_hora_salida) : 'En sitio',
        formatMinutos(minutosEstadia(r)),
        limpiar(r.nota_vigilante) || '—',
      ]),
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        1: { cellWidth: 24 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 34 },
        5: { cellWidth: 16 },
        6: { cellWidth: 22 },
        7: { cellWidth: 24 },
        8: { cellWidth: 17 },
        9: { cellWidth: 'auto', fontSize: 7.5 },
      },
    });
  }

  // ── Pie de página ──
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_3);
    doc.text('Guaicaramo — Control de visitas · Ingresos de gerentes UEA', M, pageH - 6);
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 6, { align: 'right' });
  }

  const sello = `${generado.getFullYear()}${pad(generado.getMonth() + 1)}${pad(generado.getDate())}-${pad(generado.getHours())}${pad(generado.getMinutes())}`;
  doc.save(`informe-ingresos-gerentes-${sello}.pdf`);
}
