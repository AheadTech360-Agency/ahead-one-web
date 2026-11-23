"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn, hueFor, initials } from "@/lib/utils";
import type { UserSummary } from "@/lib/api/types";

type Size = "xs" | "sm" | "md" | "lg";
const sizes: Record<Size, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-12",
  lg: "size-10 text-14",
};

export type AvatarUser = Pick<UserSummary, "id" | "full_name" | "email" | "avatar_url">;

export function Avatar({
  user,
  size = "sm",
  className,
  decorative = false,
}: {
  user: AvatarUser;
  size?: Size;
  className?: string;
  /** Set when the name is printed next to the avatar, so it is not read twice. */
  decorative?: boolean;
}) {
  const name = user.full_name || user.email;
  const hue = hueFor(user.id);
  return (
    <AvatarPrimitive.Root
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full align-middle",
        sizes[size],
        className,
      )}
    >
      {user.avatar_url && (
        <AvatarPrimitive.Image src={user.avatar_url} alt="" className="size-full object-cover" />
      )}
      <AvatarPrimitive.Fallback
        delayMs={user.avatar_url ? 400 : 0}
        className={cn(
          "flex size-full items-center justify-center font-semibold",
          "bg-[oklch(0.92_0.035_var(--h))] text-[oklch(0.38_0.07_var(--h))]",
          "dark:bg-[oklch(0.34_0.045_var(--h))] dark:text-[oklch(0.9_0.04_var(--h))]",
        )}
        style={{ "--h": hue } as React.CSSProperties}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** Overlapping avatars with a "+N" overflow count. */
export function AvatarStack({
  users,
  max = 4,
  size = "sm",
  className,
}: {
  users: AvatarUser[];
  max?: number;
  size?: Size;
  className?: string;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  const label = users.map((u) => u.full_name || u.email).join(", ");
  return (
    <div role="group" aria-label={label} className={cn("flex items-center -space-x-1", className)}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} decorative className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-active font-medium text-fg-muted ring-2 ring-surface tabular",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
