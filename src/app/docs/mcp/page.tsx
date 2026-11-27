import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/ui/brand-mark";

export const metadata: Metadata = {
  title: "Connect AheadOne to Claude",
  description: "Let an AI assistant read your messages and tasks and act for you, through your own AheadOne account.",
};

/** Same address the in-app Connected apps pages show. */
const MCP_URL = "https://ahead-one-api-production.up.railway.app/mcp";
const CLAUDE_CODE = `claude mcp add --transport http ahead-one ${MCP_URL}`;

const PERMISSIONS: { name: string; what: string }[] = [
  { name: "Read messages and channels", what: "List conversations, read messages (who, where, when), search chats, mark a conversation read" },
  { name: "Read tasks and projects", what: "List spaces, projects and tasks, open a task with its comments and history" },
  { name: "Read files you can access", what: "List files and fetch attachments" },
  { name: "Read your daily brief", what: "The summary of what needs your attention" },
  { name: "Read who is on the team", what: "Members and the team dashboard" },
  { name: "Send messages as you", what: "Post messages in chats you are in" },
  { name: "Create and update tasks", what: "Create tasks, edit them, change assignees, add comments" },
  { name: "Attach files to tasks", what: "Upload documents onto tasks and chats" },
];

const TROUBLE: { seen: string; fix: string }[] = [
  { seen: "Claude cannot add the connector, or says the server is unreachable", fix: "Check that the address ends in /mcp and has no spaces. Open it in a browser: a plain \"unauthorized\" answer means the server is up." },
  { seen: "\"Cannot connect this app\" page", fix: "Go back to Claude and start the connection again. Do not reuse an old tab." },
  { seen: "The consent page says the request expired", fix: "Requests last a few minutes. Start again from Claude." },
  { seen: "\"Not found in this app's workspace\"", fix: "The item is in a different workspace than the one you chose when you connected." },
  { seen: "Claude can read but cannot send or create", fix: "You did not tick the write permissions. Disconnect the app in Settings, then connect again and tick them." },
  { seen: "Claude says there are too many requests", fix: "There is a limit of 120 calls a minute and 30 changes a minute. Wait a minute." },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-13 font-semibold text-fg-on-accent" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-15 leading-relaxed text-fg">{children}</div>
    </li>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-sunken px-3 py-2.5 font-mono text-13 text-fg">
      <code>{children}</code>
    </pre>
  );
}

export default function McpGuidePage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center gap-2.5 px-5 py-4 sm:px-8">
        <BrandMark className="size-6" />
        <span className="font-display text-16 font-semibold tracking-[-0.01em] text-fg">AheadOne</span>
      </header>
      <main className="mx-auto max-w-[44rem] px-4 pb-20 pt-2 sm:px-6">
        <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-fg">Connect AheadOne to Claude</h1>
        <p className="mt-2 text-17 text-fg-muted">
          Let Claude read your messages and tasks, write replies, create tasks and get your daily brief, using your own AheadOne
          account. It takes about two minutes.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-surface-raised px-4 py-3 text-14 text-fg">
          <strong className="font-semibold">What you need:</strong> an AheadOne account, and Claude (claude.ai, Claude Desktop or Claude
          Code). Owners and Admins use their authenticator code at sign-in as usual.
        </div>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">The address you will paste</h2>
        <div className="mt-3">
          <Code>{MCP_URL}</Code>
        </div>
        <p className="mt-2 text-14 text-fg-muted">Use this exact address. It ends in /mcp, with no trailing slash.</p>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">Option A: claude.ai or Claude Desktop</h2>
        <ol className="mt-4 space-y-6">
          <Step n={1}>
            <p>
              <strong className="font-semibold">Open the connectors settings.</strong> In Claude, open Settings, then Connectors. On a
              work or team plan, an Owner or admin of your Claude organization may need to turn custom connectors on first.
            </p>
          </Step>
          <Step n={2}>
            <p>
              <strong className="font-semibold">Add a custom connector.</strong> Choose Add custom connector. Name it AheadOne and
              paste the address above into the URL field. Leave any advanced client ID or secret fields empty, because AheadOne
              registers Claude automatically. Save.
            </p>
          </Step>
          <Step n={3}>
            <p>
              <strong className="font-semibold">Connect.</strong> Click Connect next to AheadOne. Your browser opens the AheadOne
              sign-in page. Sign in if you are asked to.
            </p>
          </Step>
          <Step n={4}>
            <p>
              <strong className="font-semibold">Choose what Claude may do.</strong> You see this page. Read it before you press Allow.
            </p>
            <figure>
              <Image
                src="/docs/mcp/consent.png"
                alt="The AheadOne consent page: Claude wants to access your AheadOne account, with Read permissions ticked, Write permissions unticked, and a list of things the app can never do."
                width={1270}
                height={1066}
                className="h-auto w-full rounded-lg border border-border"
              />
              <figcaption className="mt-1.5 text-13 text-fg-muted">
                The consent page. The name and email shown are a sample. Read permissions start ticked, and Write permissions start unticked.
              </figcaption>
            </figure>
            <ul className="list-disc space-y-1.5 pl-5 text-15">
              <li>
                <strong className="font-semibold">Check the address under &quot;your browser returns to&quot;.</strong> For Claude it is
                claude.ai. If you see anything else, press Cancel.
              </li>
              <li>
                <strong className="font-semibold">The &quot;Unverified app&quot; warning always shows.</strong> Claude registers itself and
                nobody reviews it, so the warning is expected. Continue only if you started this connection yourself.
              </li>
              <li>
                <strong className="font-semibold">Tick only what you want.</strong> Write permissions let Claude send messages as you,
                create and update tasks, and attach files to tasks. Leave them off if you only want it to read.
              </li>
              <li>
                <strong className="font-semibold">If you belong to more than one workspace,</strong> pick the one this connection is for.
                It can only ever see that one.
              </li>
            </ul>
            <p>Press Allow. You are sent back to Claude, and AheadOne shows as connected.</p>
          </Step>
          <Step n={5}>
            <p>
              <strong className="font-semibold">Turn it on in a chat.</strong> In a new conversation, open the tools or connectors menu
              and make sure AheadOne is switched on. Then try one of the prompts below.
            </p>
          </Step>
        </ol>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">Option B: Claude Code</h2>
        <p className="mt-2 text-15 text-fg">Run this once in your terminal:</p>
        <div className="mt-3">
          <Code>{CLAUDE_CODE}</Code>
        </div>
        <p className="mt-3 text-15 text-fg">
          Then start Claude Code, run /mcp, choose ahead-one and choose to authenticate. Your browser opens the same consent page as above.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">Try it</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-15 text-fg">
          <li>&quot;Give me my AheadOne brief for today.&quot;</li>
          <li>&quot;What did Khaleel message me about this week?&quot;</li>
          <li>&quot;Show my open tasks due this week, most urgent first.&quot;</li>
          <li>&quot;Search the chats for the Acme invoice.&quot;</li>
          <li>&quot;Create a task in the Acme project called Send revised proposal, due Friday.&quot; (needs the write permission for tasks)</li>
          <li>&quot;Reply to the last message in #design saying I will review it by 3pm.&quot; (needs the write permission for messages)</li>
        </ul>
        <p className="mt-3 rounded-lg bg-success-subtle px-4 py-3 text-14 text-success-text">
          Claude usually asks before it uses a tool. Check any message it is about to send, because it is sent as you.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">What Claude can and cannot do</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-14">
            <thead className="bg-surface-sunken text-12 uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Permission</th>
                <th className="px-3 py-2 font-medium">What it allows</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.name} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-fg">{p.name}</td>
                  <td className="px-3 py-2 text-fg-muted">{p.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-15 text-fg">
          <strong className="font-semibold">Claude can never</strong> delete anything, invite people, change anyone&apos;s role or client
          access, change settings, or see other people&apos;s private tasks. It sees only what your own account can see, in the one
          workspace you chose. Its access ends the moment you disconnect it, change your password or are removed from the workspace.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">Seeing and removing connected apps</h2>
        <p className="mt-2 text-15 text-fg">
          On the web, open <strong className="font-semibold">Settings, then Connected apps</strong>. In the phone app, open{" "}
          <strong className="font-semibold">Profile, then Connected apps</strong>. Each app shows what it may do, when it connected, when
          it was last used and how many calls it made this week. Press Revoke (web) or Disconnect (phone) to cut it off immediately.
          Owners also see an &quot;Everyone&apos;s apps&quot; tab on the web.
        </p>
        <figure className="mt-4">
          <Image
            src="/docs/mcp/connected-apps.png"
            alt="The Connected apps settings page listing three sample apps with permission chips, connected date, last used and calls this week, each with a Revoke button."
            width={1280}
            height={640}
            loading="eager"
            className="h-auto w-full rounded-lg border border-border"
          />
          <figcaption className="mt-1.5 text-13 text-fg-muted">Settings, Connected apps. The apps shown are samples.</figcaption>
        </figure>
        <p className="mt-3 text-15 text-fg">
          Access also expires on its own: after 30 days without use, or 90 days at most, you are asked to connect again.
        </p>

        <h2 className="mt-10 font-display text-xl font-semibold text-fg">If something goes wrong</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-14">
            <thead className="bg-surface-sunken text-12 uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">You see</th>
                <th className="px-3 py-2 font-medium">Try this</th>
              </tr>
            </thead>
            <tbody>
              {TROUBLE.map((t) => (
                <tr key={t.seen} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-fg">{t.seen}</td>
                  <td className="px-3 py-2 text-fg-muted">{t.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-12 border-t border-border pt-4 text-13 text-fg-muted">
          <Link href="/" className="underline underline-offset-2">
            Open AheadOne
          </Link>
          . Claude&apos;s own menu names can differ slightly between apps and plans.
        </p>
      </main>
    </div>
  );
}
