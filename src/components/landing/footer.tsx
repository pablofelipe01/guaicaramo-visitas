import { Wordmark } from '../decorations';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Wordmark />
          <p className="footer-tag">
            Trabajamos con responsabilidad por amor a nuestra labor.
          </p>
        </div>
      </div>
      <div className="container footer-base">
        <span>© {year} Guaicaramo S.A.S · Barranca de Upía, Meta</span>
        <span>Sistema interno · v1.0</span>
      </div>
    </footer>
  );
}
