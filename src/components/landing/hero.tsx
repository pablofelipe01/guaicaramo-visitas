'use client';

import Image from 'next/image';

export function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-bg" aria-hidden="true">
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="bgA" cx="80%" cy="20%" r="50%">
              <stop offset="0%" stopColor="rgba(251,173,23,0.13)" />
              <stop offset="100%" stopColor="rgba(251,173,23,0)" />
            </radialGradient>
            <radialGradient id="bgB" cx="10%" cy="90%" r="50%">
              <stop offset="0%" stopColor="rgba(13,177,75,0.13)" />
              <stop offset="100%" stopColor="rgba(13,177,75,0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgA)" />
          <rect width="100%" height="100%" fill="url(#bgB)" />
        </svg>
      </div>

      <div className="container">
        <div className="hero-grid">
          <div>
            <p className="hero-eyebrow">
              <span className="dot" />
              Sistema interno · Guaicaramo S.A.S.
            </p>
            <h1 className="hero-title balance">
              Cada visita,<br />
              <em>cada llegada,</em><br />
              con propósito.
            </h1>
            <p className="hero-sub pretty">
              Plataforma de control y autorización de visitas para porterías, plantas, lotes
              y oficinas. Hecha para Recepción, líderes de área y vigilancia — en cualquier
              dispositivo, en cualquier turno.
            </p>
            <div className="hero-ctas">
              <a href="/login" className="btn btn-primary btn-lg">
                Ingresar al sistema
                <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          <div className="hero-photo-wrap" aria-hidden="true">
            <div className="hero-photo-frame">
              <div className="hero-photo-border hero-photo-border--1" />
              <div className="hero-photo-border hero-photo-border--2" />
              <div className="hero-photo-inner">
                <Image
                  src="/Gente de Campo.jpg.jpeg"
                  alt="Gente de Campo — Guaicaramo"
                  fill
                  sizes="(max-width: 979px) 90vw, 45vw"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                  priority
                />
              </div>
              <div className="hero-photo-badge">
                <span className="hero-photo-badge-dot" />
                Guaicaramo S.A.S.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
