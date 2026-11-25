import { BrandMark } from "@/ui/brand-mark";

/*
 * Auth screens: on wide screens a navy brand panel (the site's navy-section treatment, on-navy
 * text, a green marker) beside the form; on phones the form alone under the mark.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="hidden w-[40%] max-w-[560px] shrink-0 flex-col justify-between bg-band px-10 py-10 text-band-fg lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center bg-band-fg">
            <BrandMark className="size-6 [--mark-navy:#1d3c73] [--mark-green:#24b574]" />
          </span>
          <span className="font-display text-16 font-semibold tracking-[-0.01em]">AheadOne</span>
        </div>
        <div className="max-w-[400px]">
          <span aria-hidden className="mb-5 block h-1 w-10 bg-green" />
          <p className="font-display text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-band-fg">
            Projects, tasks and messages for the AheadTech360 team.
          </p>
        </div>
        <p className="text-12 text-band-dim">AheadTech360 internal workspace. Access is by invitation only.</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[380px]">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <BrandMark className="size-7" />
              <span className="font-display text-16 font-semibold tracking-[-0.01em] text-fg">AheadOne</span>
            </div>
            {children}
          </div>
        </main>
        <footer className="px-4 pb-6 text-center text-12 text-fg-muted lg:hidden">
          AheadTech360 internal workspace. Access is by invitation only.
        </footer>
      </div>
    </div>
  );
}
