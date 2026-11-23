export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[12vh]">
        <div className="w-full max-w-[380px]">
          <div className="mb-6 flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex size-7 items-center justify-center rounded-sm bg-accent text-12 font-bold tracking-tight text-fg-on-accent"
            >
              A1
            </span>
            <span className="text-14 font-semibold text-fg">AheadOne</span>
          </div>
          {children}
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-12 text-fg-muted">
        AheadTech360 internal workspace. Access is by invitation only.
      </footer>
    </div>
  );
}
