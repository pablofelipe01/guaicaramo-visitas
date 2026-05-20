export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-8 dark:from-zinc-900 dark:to-black">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-10 shadow-lg dark:bg-zinc-900">
        <h1 className="text-4xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
          Guaicaramo Visitas
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300">
          App base creada con Next.js, TypeScript y Tailwind CSS.
        </p>

        <ul className="mt-8 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>✔ Next.js (App Router)</li>
          <li>✔ TypeScript</li>
          <li>✔ Tailwind CSS</li>
          <li>✔ ESLint</li>
        </ul>

        <div className="mt-8 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          Edita <code className="font-mono text-emerald-700 dark:text-emerald-400">src/app/page.tsx</code> para empezar.
        </div>
      </div>
    </main>
  );
}
