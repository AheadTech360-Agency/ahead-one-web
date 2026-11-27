import { cn } from "@/lib/utils";
import { barHeight } from "./logic";

/** 64 bars; the first `progress` (0..1) share is drawn in the active colour. Decorative: the player labels itself. */
export function Waveform({
  bars,
  progress = 0,
  className,
  barClass = "bg-fg-faint/60",
  activeClass = "bg-accent",
}: {
  bars: readonly number[];
  progress?: number;
  className?: string;
  barClass?: string;
  activeClass?: string;
}) {
  const played = Math.round(progress * bars.length);
  return (
    <div aria-hidden className={cn("flex h-8 items-center gap-px", className)}>
      {bars.map((v, i) => (
        <span
          key={i}
          className={cn("min-w-px flex-1 rounded-full", i < played ? activeClass : barClass)}
          style={{ height: `${Math.round(barHeight(v) * 100)}%` }}
        />
      ))}
    </div>
  );
}
