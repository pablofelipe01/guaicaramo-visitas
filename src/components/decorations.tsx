import Link from 'next/link';
import Image from 'next/image';
import type { SVGProps } from 'react';

/** Wordmark: logo image */
export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="Guaicaramo Visitas">
      <Image
        src="/logo-guaicaramo.png"
        alt="Guaicaramo Visitas"
        width={160}
        height={48}
        priority
        style={{ height: 'auto', width: 'auto', maxHeight: 48 }}
      />
    </Link>
  );
}

/** Decoración de palma animada (login panel + hero) */
export function PalmDecoration({ className, style }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 400" className={className} style={style as React.CSSProperties} aria-hidden="true">
      <defs>
        <radialGradient id="palmGlow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(232,154,44,0.4)" />
          <stop offset="100%" stopColor="rgba(232,154,44,0)" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="380" r="180" fill="url(#palmGlow)" />
      <g transform="translate(200 360)">
        <path className="palm-leaf" d="M0 0 C -30 -50 -90 -90 -160 -100 C -120 -130 -60 -130 -20 -110 Z" fill="currentColor" opacity="0.85" />
        <path className="palm-leaf palm-leaf-2" d="M0 0 C -10 -60 -50 -130 -120 -180 C -70 -190 -20 -160 0 -110 Z" fill="currentColor" opacity="0.7" />
        <path className="palm-leaf palm-leaf-3" d="M0 0 C 30 -50 90 -90 160 -100 C 120 -130 60 -130 20 -110 Z" fill="currentColor" opacity="0.85" />
        <path className="palm-leaf palm-leaf-4" d="M0 0 C 10 -60 50 -130 120 -180 C 70 -190 20 -160 0 -110 Z" fill="currentColor" opacity="0.7" />
        <path d="M0 0 C 5 -50 5 -110 0 -200 C -5 -110 -5 -50 0 0 Z" fill="currentColor" opacity="0.5" />
        <path d="M -8 0 C -6 -30 -4 -60 0 -100 C 4 -60 6 -30 8 0 Z" fill="rgba(0,0,0,0.25)" />
      </g>
    </svg>
  );
}

/** Ilustración principal del hero — escena llanera */
export function HeroArt() {
  return (
    <svg viewBox="0 0 560 580" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="55%" stopColor="#FAF6EC" />
          <stop offset="100%" stopColor="#E8F2EA" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD37A" />
          <stop offset="60%" stopColor="#F4B14A" />
          <stop offset="100%" stopColor="rgba(244,177,74,0)" />
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E9447" />
          <stop offset="100%" stopColor="#1B7A3E" />
        </linearGradient>
        <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B3E1F" />
          <stop offset="100%" stopColor="#3A2A14" />
        </linearGradient>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0D4A28" floodOpacity="0.15" />
        </filter>
      </defs>

      <rect x="20" y="20" width="520" height="540" rx="28" fill="url(#sky)" />

      {/* Sol */}
      <g>
        <circle className="float-orb" cx="170" cy="170" r="120" fill="url(#sun)" opacity="0.85" />
        <circle cx="170" cy="170" r="48" fill="#F4B14A" />
        <circle cx="170" cy="170" r="48" fill="#FFD37A" opacity="0.6" />
      </g>

      {/* Horizonte llanero */}
      <path d="M 20 410 Q 140 360 280 390 T 540 380 L 540 460 L 20 460 Z" fill="#7BB892" opacity="0.55" />
      <path d="M 20 440 Q 180 405 340 425 T 540 420 L 540 480 L 20 480 Z" fill="#5DA579" opacity="0.7" />

      <rect x="20" y="460" width="520" height="100" fill="url(#ground)" />
      <g opacity="0.18" stroke="#0D4A28" strokeWidth="1.5" fill="none">
        <path d="M 20 478 Q 280 472 540 480" />
        <path d="M 20 498 Q 280 492 540 502" />
        <path d="M 20 522 Q 280 516 540 526" />
        <path d="M 20 546 Q 280 540 540 552" />
      </g>

      {/* Nubes */}
      <g className="float-orb-2" fill="#FFFCF4" opacity="0.85">
        <ellipse cx="420" cy="120" rx="48" ry="14" />
        <ellipse cx="400" cy="112" rx="28" ry="10" />
        <ellipse cx="448" cy="114" rx="22" ry="9" />
      </g>
      <g className="float-orb-3" fill="#FFFCF4" opacity="0.7">
        <ellipse cx="320" cy="200" rx="38" ry="11" />
        <ellipse cx="306" cy="194" rx="20" ry="8" />
      </g>

      {/* Palma principal */}
      <g transform="translate(380 460)">
        <path d="M -10 0 C -12 -80 -8 -160 -2 -240 C 4 -160 8 -80 6 0 Z" fill="url(#trunk)" />
        <g stroke="#3A2A14" strokeWidth="1" opacity="0.5">
          <path d="M -9 -40 Q 0 -36 5 -40" fill="none" />
          <path d="M -10 -90 Q 0 -86 6 -90" fill="none" />
          <path d="M -10 -140 Q 0 -136 7 -140" fill="none" />
          <path d="M -10 -190 Q 0 -186 7 -190" fill="none" />
        </g>
        <g transform="translate(0 -244)">
          <path className="palm-leaf" d="M 0 0 C -40 -10 -100 -10 -150 10 C -120 -40 -50 -50 0 -20 Z" fill="#0F5132" />
          <path className="palm-leaf palm-leaf-2" d="M 0 0 C 40 -10 100 -10 150 10 C 120 -40 50 -50 0 -20 Z" fill="#1B7A3E" />
          <path className="palm-leaf palm-leaf-3" d="M 0 0 C -20 -40 -50 -80 -110 -110 C -50 -110 -10 -60 0 -20 Z" fill="#2E9447" />
          <path className="palm-leaf palm-leaf-4" d="M 0 0 C 20 -40 50 -80 110 -110 C 50 -110 10 -60 0 -20 Z" fill="#0F5132" />
          <path className="palm-leaf" d="M 0 0 C -10 -50 -10 -120 -5 -180 C 5 -120 10 -50 0 0 Z" fill="#1B7A3E" />
          <g transform="translate(0 -8)">
            <circle cx="-12" cy="6" r="7" fill="#E89A2C" />
            <circle cx="0" cy="2" r="8" fill="#D17920" />
            <circle cx="12" cy="6" r="7" fill="#E89A2C" />
            <circle cx="-6" cy="14" r="6" fill="#C46A18" />
            <circle cx="6" cy="14" r="6" fill="#C46A18" />
            <circle cx="0" cy="20" r="5" fill="#A85613" />
          </g>
        </g>
      </g>

      {/* Palma de fondo */}
      <g transform="translate(130 460)" opacity="0.65">
        <path d="M -6 0 C -8 -60 -4 -120 0 -160 C 4 -120 8 -60 4 0 Z" fill="url(#trunk)" />
        <g transform="translate(0 -164)">
          <path className="palm-leaf palm-leaf-2" d="M 0 0 C -30 -10 -70 -10 -100 0 C -80 -30 -30 -40 0 -15 Z" fill="#1B7A3E" />
          <path className="palm-leaf palm-leaf-4" d="M 0 0 C 30 -10 70 -10 100 0 C 80 -30 30 -40 0 -15 Z" fill="#0F5132" />
          <path className="palm-leaf palm-leaf-3" d="M 0 0 C -10 -30 -10 -80 -5 -110 C 5 -80 5 -30 0 0 Z" fill="#2E9447" />
        </g>
      </g>

      {/* Card: ingreso registrado */}
      <g transform="translate(330 70)">
        <rect width="200" height="92" rx="14" fill="#FFFCF4" stroke="rgba(13,74,40,0.10)" strokeWidth="1" filter="url(#cardShadow)" />
        <circle cx="22" cy="26" r="12" fill="#E8F2EA" />
        <path d="M 17 26 L 21 30 L 28 22" stroke="#1B7A3E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="42" y="22" fontFamily="Manrope, sans-serif" fontSize="10" fontWeight="700" fill="#1A2118" letterSpacing="1">INGRESO REGISTRADO</text>
        <text x="42" y="38" fontFamily="Manrope, sans-serif" fontSize="13" fontWeight="600" fill="#1A2118">Mauricio Pineda Rojas</text>
        <text x="42" y="56" fontFamily="Manrope, sans-serif" fontSize="10" fill="#6B7A6B">CC 79.482.611 · Lote 12 — El Trapiche</text>
        <rect x="42" y="68" width="68" height="18" rx="9" fill="#1B7A3E" />
        <text x="76" y="80" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="9" fontWeight="700" fill="#FAF6EC" letterSpacing="0.5">AUTORIZADO</text>
        <text x="178" y="80" textAnchor="end" fontFamily="Manrope, sans-serif" fontSize="10" fill="#6B7A6B">06:42</text>
      </g>

      {/* Card: búsqueda vehículo */}
      <g transform="translate(36 350)">
        <rect width="220" height="60" rx="14" fill="#FFFCF4" stroke="rgba(13,74,40,0.10)" strokeWidth="1" />
        <circle cx="22" cy="30" r="11" fill="none" stroke="#1B7A3E" strokeWidth="2" />
        <path d="M 30 38 L 36 44" stroke="#1B7A3E" strokeWidth="2" strokeLinecap="round" />
        <text x="44" y="27" fontFamily="Manrope, sans-serif" fontSize="11" fontWeight="600" fill="#1A2118">BPC 482</text>
        <text x="44" y="44" fontFamily="Manrope, sans-serif" fontSize="9.5" fill="#6B7A6B">Vehículo autorizado · Planta extractora</text>
      </g>
    </svg>
  );
}

/** Definiciones SVG globales (filtro sombra) */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0D4A28" floodOpacity="0.15" />
        </filter>
      </defs>
    </svg>
  );
}
