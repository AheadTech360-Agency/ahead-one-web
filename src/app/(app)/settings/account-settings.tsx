"use client";

import { CircleAlert, Monitor, Moon, RotateCw, ShieldCheck, Sun } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";
import { PageHeader } from "@/components/page";
import { NewPasswordFields, validateNewPassword } from "@/components/auth/new-password-fields";
import { errorMessage, isApiError } from "@/lib/api/client";
import {
  useChangePassword,
  useNotificationPrefs,
  useSetTwoFactor,
  useUpdateMe,
  useUpdateNotificationPrefs,
} from "@/lib/api/hooks";
import type { MeResponse, NotificationKind, NotificationPrefs, Profile } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Checkbox, Switch } from "@/ui/checkbox";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";
import { Select } from "@/ui/select";
import { Skeleton, SkeletonRows } from "@/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { toast } from "@/ui/toaster";
import { BrowserPushControl } from "@/features/push/push-controls";

const TABS = ["profile", "appearance", "notifications", "security"] as const;
type Tab = (typeof TABS)[number];

export function AccountSettings() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "profile";

  return (
    <>
      <PageHeader title="Profile and preferences" description="These settings apply to your account only." />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(v === "profile" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}
        className="mt-5"
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-6 outline-none">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="appearance" className="pt-6 outline-none">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="notifications" className="pt-6 outline-none">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="security" className="pt-6 outline-none">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ---------- Profile ---------- */

const noop = () => () => {};
const SERVER_ZONES = ["UTC"];
let zoneCache: string[] | null = null;
function readZones(): string[] {
  if (!zoneCache) {
    try {
      zoneCache = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      zoneCache = SERVER_ZONES;
    }
  }
  return zoneCache;
}
function useTimezones() {
  return useSyncExternalStore(noop, readZones, () => SERVER_ZONES);
}

function ProfileTab() {
  const { me, meStatus, meError, refetchMe } = useWorkspace();
  if (meStatus === "pending") {
    return (
      <div className="flex max-w-md flex-col gap-5" role="status" aria-label="Loading profile">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-full rounded-sm" />
          </div>
        ))}
      </div>
    );
  }
  if (meStatus === "error" || !me) {
    return (
      <EmptyState
        compact
        tone="danger"
        icon={CircleAlert}
        title="Couldn't load your profile"
        description={errorMessage(meError)}
        action={
          <Button size="sm" onClick={refetchMe}>
            <RotateCw aria-hidden /> Retry
          </Button>
        }
      />
    );
  }
  return <ProfileForm key={me.user.id} user={me.user} />;
}

function ProfileForm({ user }: { user: Profile }) {
  const update = useUpdateMe();
  const zones = useTimezones();
  const [name, setName] = useState(user.full_name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [error, setError] = useState<string | undefined>();
  const dirty = name.trim() !== user.full_name || timezone !== user.timezone;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name as teammates should see it.");
      return;
    }
    update.mutate(
      { full_name: name.trim(), timezone },
      {
        onSuccess: () => toast.success("Profile saved"),
        onError: (err) => toast.error("Couldn't save your profile", { description: errorMessage(err) }),
      },
    );
  }

  const zoneOptions = (zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => ({
    value: z,
    label: z.replaceAll("_", " "),
  }));

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-5">
      <div className="flex items-center gap-3">
        <Avatar user={{ ...user, full_name: name || user.full_name }} size="lg" decorative />
        <div className="min-w-0">
          <p className="truncate text-14 font-medium">{name || user.email}</p>
          <p className="truncate text-12 text-fg-muted">{user.email}</p>
        </div>
      </div>
      <Field label="Full name" error={error}>
        <Input
          value={name}
          autoComplete="name"
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(undefined);
          }}
        />
      </Field>
      <Field label="Email" hint="Ask a workspace admin to change the email you sign in with.">
        <Input value={user.email} readOnly disabled />
      </Field>
      <Field label="Time zone" hint="Due dates and reminders use this time zone.">
        <Select value={timezone} onValueChange={setTimezone} options={zoneOptions} />
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={!dirty} loading={update.isPending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

/* ---------- Appearance ---------- */

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const current = useSyncExternalStore(noop, () => theme ?? "system", () => "system");
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Match system", icon: Monitor },
  ];
  return (
    <fieldset className="max-w-xl">
      <legend className="text-14 font-semibold">Theme</legend>
      <p className="mt-0.5 text-13 text-fg-muted">Saved on this device. Shift+T switches between light and dark.</p>
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const on = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(o.value)}
              className={cn(
                "flex flex-col overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
              )}
            >
              <ThemePreview kind={o.value} />
              <span className="flex items-center gap-2 border-t border-border px-3 py-2 text-13 font-medium">
                <o.icon className="size-4 text-fg-faint" aria-hidden />
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Miniature of the shell in each theme, drawn from fixed values so it previews the other theme too. */
function ThemePreview({ kind }: { kind: string }) {
  const half = (dark: boolean) => (
    <div className={cn("flex h-full flex-1 gap-1.5 p-2", dark ? "bg-[#0b1730]" : "bg-[#f5f7fa]")}>
      <div className="flex w-1/4 flex-col gap-1 pt-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1 rounded-full", dark ? "bg-[#3a5687]" : "bg-[#c9cdd8]")} />
        ))}
      </div>
      <div className={cn("flex flex-1 flex-col gap-1 rounded-[3px] border p-1.5", dark ? "border-[#213a64] bg-[#10203d]" : "border-[#e2e4ea] bg-white")}>
        <span className={cn("h-1 w-1/2 rounded-full", dark ? "bg-[#ffffff]" : "bg-[#14161a]")} />
        <span className={cn("h-1 w-3/4 rounded-full", dark ? "bg-[#3a5687]" : "bg-[#e2e4ea]")} />
        <span className={cn("mt-auto h-1.5 w-1/3 shadow-[2px_2px_0_0_#24b574]", dark ? "bg-[#4472c0]" : "bg-[#1d3c73]")} />
      </div>
    </div>
  );
  return (
    <span aria-hidden className="flex h-20">
      {kind === "light" && half(false)}
      {kind === "dark" && half(true)}
      {kind === "system" && (
        <>
          {half(false)}
          {half(true)}
        </>
      )}
    </span>
  );
}

/* ---------- Notifications ---------- */

const KIND_LABEL: Record<NotificationKind, { label: string; line: string }> = {
  task_assigned: { label: "Assigned to me", line: "Someone assigns you a task" },
  mentioned: { label: "Mentions", line: "Someone @mentions you" },
  task_comment: { label: "Comments", line: "New comments on tasks you follow" },
  task_due_soon: { label: "Due soon", line: "Your tasks due in the next 24 hours" },
  task_overdue: { label: "Overdue", line: "Your tasks that pass their due date" },
  direct_message: { label: "Direct messages", line: "New messages sent to you" },
};

function NotificationsTab() {
  const q = useNotificationPrefs();
  if (q.isPending) return <SkeletonRows rows={6} columns={[40, 8, 8, 8]} />;
  if (q.isError) {
    return (
      <EmptyState
        compact
        tone="danger"
        icon={CircleAlert}
        title="Couldn't load notification settings"
        description={errorMessage(q.error)}
        action={
          <Button size="sm" onClick={() => q.refetch()}>
            <RotateCw aria-hidden /> Retry
          </Button>
        }
      />
    );
  }
  return <NotificationPrefsForm initial={q.data} />;
}

function NotificationPrefsForm({ initial }: { initial: NotificationPrefs }) {
  const save = useUpdateNotificationPrefs();
  const [prefs, setPrefs] = useState(initial);

  function commit(next: NotificationPrefs) {
    const prev = prefs;
    setPrefs(next);
    save.mutate(next, {
      onSuccess: () => toast.success("Notification settings saved"),
      onError: (e) => {
        setPrefs(prev);
        toast.error("Couldn't save notification settings", { description: errorMessage(e) });
      },
    });
  }

  const channels = [
    { key: "in_app", label: "In app" },
    { key: "email", label: "Email" },
    { key: "push", label: "Push" },
  ] as const;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <table className="w-full text-13">
        <caption className="sr-only">Notification channels by event</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="h-9 text-left text-12 font-normal text-fg-muted">
              Notify me when
            </th>
            {channels.map((c) => (
              <th key={c.key} scope="col" className="h-9 w-20 text-center text-12 font-normal text-fg-muted">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prefs.prefs.map((p, i) => (
            <tr key={p.kind} className="border-b border-border-subtle">
              <th scope="row" className="py-2.5 text-left font-normal">
                <span className="block font-medium text-fg">{KIND_LABEL[p.kind]?.label ?? p.kind}</span>
                <span className="block text-12 text-fg-muted">{KIND_LABEL[p.kind]?.line}</span>
              </th>
              {channels.map((c) => (
                <td key={c.key} className="text-center">
                  <span className="inline-flex">
                    <Checkbox
                      aria-label={`${KIND_LABEL[p.kind]?.label ?? p.kind}: ${c.label}`}
                      checked={p[c.key]}
                      onCheckedChange={(v) =>
                        commit({
                          ...prefs,
                          prefs: prefs.prefs.map((x, j) => (j === i ? { ...x, [c.key]: v === true } : x)),
                        })
                      }
                    />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <BrowserPushControl />
      <Switch
        label="Daily digest"
        description="One email each morning with what's due and what changed."
        checked={prefs.daily_digest}
        onCheckedChange={(v) => commit({ ...prefs, daily_digest: v })}
      />
    </div>
  );
}

/* ---------- Security ---------- */

function SecurityTab() {
  const { me, meStatus, meError, refetchMe } = useWorkspace();
  if (meStatus === "pending") return <SkeletonRows rows={4} columns={[40, 20]} />;
  if (meStatus === "error" || !me) {
    return (
      <EmptyState
        compact
        tone="danger"
        icon={CircleAlert}
        title="Couldn't load your security settings"
        description={errorMessage(meError)}
        action={
          <Button size="sm" onClick={refetchMe}>
            <RotateCw aria-hidden /> Retry
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex max-w-xl flex-col gap-10">
      <SessionSection me={me} />
      <TwoFactorSection me={me} />
      <PasswordSection />
    </div>
  );
}

function SectionHead({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-14 font-semibold">{title}</h2>
      <p className="mt-0.5 text-13 text-fg-muted">{children}</p>
    </div>
  );
}

function SessionSection({ me }: { me: MeResponse }) {
  const confirmed = me.aal === "aal2";
  return (
    <section aria-labelledby="sec-session" className="flex flex-col gap-3">
      <div id="sec-session">
        <SectionHead title="This session">How you signed in on this device.</SectionHead>
      </div>
      <p className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-13">
        <ShieldCheck className={cn("size-4 shrink-0", confirmed ? "text-green-text" : "text-fg-faint")} aria-hidden />
        <span>
          <span className="font-medium">{confirmed ? "Password and email code" : "Password only"}</span>
          <span className="text-fg-muted">
            {confirmed ? " (confirmed with a code sent to your email)" : " (no email code was needed for this sign-in)"}
          </span>
        </span>
      </p>
    </section>
  );
}

function TwoFactorSection({ me }: { me: MeResponse }) {
  const set = useSetTwoFactor();
  const [target, setTarget] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const required = me.two_factor_required;
  const enabled = me.two_factor_enabled;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (target === null) return;
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    set.mutate(
      { enabled: target, password },
      {
        onSuccess: () => {
          toast.success(target ? "Email codes turned on" : "Email codes turned off");
          setTarget(null);
          setPassword("");
          setError(undefined);
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "invalid_credentials") setError("That password doesn't match. Try again.");
          else if (isApiError(err) && err.code === "conflict")
            setError("Your role requires email codes, so they can't be turned off.");
          else setError(errorMessage(err));
        },
      },
    );
  }

  return (
    <section aria-labelledby="sec-2fa" className="flex flex-col gap-3">
      <div id="sec-2fa">
        <SectionHead title="Email code at sign-in">
          After your password, we email a 6-digit code to confirm it&apos;s you.
        </SectionHead>
      </div>
      <Switch
        label="Require an email code"
        description={
          required
            ? "Required for Owners and Admins, so this can't be turned off."
            : enabled
              ? "On. You'll get a code every time you sign in."
              : "Off. Turn it on for an extra check when you sign in."
        }
        checked={target ?? enabled}
        disabled={required || set.isPending}
        onCheckedChange={(v) => {
          setTarget(v === enabled ? null : v);
          setError(undefined);
          setPassword("");
        }}
      />
      {target !== null && !required && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-md border border-border p-3">
          <Field label="Confirm with your password" error={error}>
            <PasswordInput
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(undefined);
              }}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={set.isPending}>
              {target ? "Turn on email codes" : "Turn off email codes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)} disabled={set.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; password?: string; confirm?: string; form?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = {
      ...validateNewPassword(password, confirm),
      current: current ? undefined : "Enter your current password.",
    };
    setErrors(v);
    if (v.current || v.password || v.confirm) return;
    change.mutate(
      { current_password: current, new_password: password },
      {
        onSuccess: () => {
          toast.success("Password changed", { description: "Your other devices have been signed out." });
          setCurrent("");
          setPassword("");
          setConfirm("");
        },
        onError: (err) => {
          if (isApiError(err) && err.code === "invalid_credentials")
            setErrors({ current: "That isn't your current password. Try again." });
          else if (isApiError(err) && err.code === "validation")
            setErrors({ password: err.message || "Choose a password between 12 and 128 characters." });
          else setErrors({ form: errorMessage(err) });
        },
      },
    );
  }

  return (
    <section aria-labelledby="sec-pw" className="flex flex-col gap-3">
      <div id="sec-pw">
        <SectionHead title="Change password">
          You stay signed in here. Every other device is signed out and needs the new password.
        </SectionHead>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Current password" error={errors.current}>
          <PasswordInput
            autoComplete="current-password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              if (errors.current) setErrors((x) => ({ ...x, current: undefined }));
            }}
          />
        </Field>
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPassword={(v) => {
            setPassword(v);
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
          }}
          onConfirm={(v) => {
            setConfirm(v);
            if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined }));
          }}
          errors={errors}
        />
        {errors.form && (
          <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-13 text-danger-text">
            {errors.form}
          </p>
        )}
        <div>
          <Button type="submit" variant="primary" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}
