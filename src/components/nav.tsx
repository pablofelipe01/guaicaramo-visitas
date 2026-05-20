'use client';

import { useEffect, useState } from 'react';
import { Wordmark } from './decorations';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={'nav' + (scrolled ? ' scrolled' : '')}>
      <div className="container nav-inner">
        <Wordmark />
        <nav className="nav-links">
          
        </nav>
        <a href="/login" className="btn btn-primary nav-cta">Ingresar</a>
      </div>
    </header>
  );
}
