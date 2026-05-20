import { SvgDefs } from '@/components/decorations';
import { Nav } from '@/components/nav';
import { Hero } from '@/components/landing/hero';
import { Footer } from '@/components/landing/footer';

export default function Home() {
  return (
    <>
      <SvgDefs />
      <Nav />
      <main>
        <Hero />
      </main>
      <Footer />
    </>
  );
}
