import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { logSize, waitForInviteLink, waitForSignInCode, wrongCodeFor } from "./helpers/mail";
import { loadRun } from "./helpers/run";
import { enterCode, expectSignedIn } from "./helpers/ui";

/*
 * The product journey, serial: the Owner joins from the invite link (password, then the emailed code),
 * builds a project, assigns a task to a teammate and @mentions them; the teammate (a second browser
 * context, no emailed code because 2FA is off for members) sees it arrive live and replies with a DM.
 */
test.describe.configure({ mode: "serial" });

const run = loadRun();
const projectName = `Spring Drop ${run.ts}`;
const spaceName = `Growth ${run.ts}`;
const taskTitle = `Write launch email ${run.ts}`;
const commentText = "please review the copy before Friday";
const dmText = `Thanks Olivia, on it ${run.ts}`;

let ownerCtx: BrowserContext;
let memberCtx: BrowserContext;
let owner: Page;
let member: Page;

test.beforeAll(async ({ browser }) => {
  ownerCtx = await browser.newContext();
  memberCtx = await browser.newContext();
  owner = await ownerCtx.newPage();
  member = await memberCtx.newPage();
});

test.afterAll(async () => {
  await ownerCtx?.close();
  await memberCtx?.close();
});

test("owner accepts the invite, a wrong code is rejected, the emailed code signs in", async () => {
  const since = logSize();
  await owner.goto(run.inviteLink);
  await expect(owner.getByRole("heading", { name: `Join ${run.workspace}` })).toBeVisible();
  await owner.getByLabel("Full name").fill(run.ownerName);
  await owner.getByLabel("New password").fill(run.password);
  await owner.getByLabel("Confirm password").fill(run.password);
  await owner.getByRole("button", { name: "Create account and join" }).click();

  // Registering and signing in hash the password twice (argon2 in a debug API build on a shared dev DB: slow).
  await expect(owner.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 60_000 });
  const code = await waitForSignInCode(run.ownerEmail, since);

  await enterCode(owner, wrongCodeFor(code));
  await expect(owner.getByRole("alert")).toBeVisible();
  await expect(owner.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await enterCode(owner, code);
  await expectSignedIn(owner);
});

test("owner creates a space and a project from the sidebar", async () => {
  await owner.getByRole("button", { name: "Create space" }).click();
  const spaceDialog = owner.getByRole("dialog", { name: "New space" });
  await spaceDialog.getByLabel("Name").fill(spaceName);
  await spaceDialog.getByRole("button", { name: "Create space" }).click();
  await expect(spaceDialog).toBeHidden();
  await expect(owner.getByRole("treeitem", { name: spaceName })).toBeVisible({ timeout: 30_000 });

  await owner.getByRole("button", { name: `New project in ${spaceName}` }).click();
  const projectDialog = owner.getByRole("dialog", { name: "New project" });
  await projectDialog.getByLabel("Name").fill(projectName);
  await projectDialog.getByRole("button", { name: "Create project" }).click();
  await expect(projectDialog).toBeHidden();
  const project = owner.getByRole("treeitem", { name: projectName });
  if (!(await project.isVisible())) await owner.getByRole("button", { name: spaceName, exact: true }).click();
  await expect(project).toBeVisible({ timeout: 30_000 });
});

test("owner invites a teammate and the teammate joins without an emailed code", async () => {
  await owner.goto("/settings/members");
  const since = logSize();
  await owner.getByRole("button", { name: "Invite people" }).click();
  const dialog = owner.getByRole("dialog", { name: "Invite to workspace" });
  await dialog.getByLabel("Email").fill(run.memberEmail);
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await expect(owner.getByText(`Invite sent to ${run.memberEmail}`)).toBeVisible();

  const link = await waitForInviteLink(run.memberEmail, since);
  await member.goto(link);
  await member.getByLabel("Full name").fill(run.memberName);
  await member.getByLabel("New password").fill(run.password);
  await member.getByLabel("Confirm password").fill(run.password);
  await member.getByRole("button", { name: "Create account and join" }).click();
  // Members have two-factor off by default: straight into the app, no "Check your email" step.
  await expectSignedIn(member);
  await expect(member.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});

test("owner creates a task assigned to the teammate", async () => {
  await owner.goto("/");
  await owner.getByRole("button", { name: "Create task" }).click();
  const dialog = owner.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(taskTitle);
  await dialog.getByRole("combobox", { name: "List" }).click();
  await owner.getByRole("option", { name: new RegExp(projectName) }).first().click();
  await dialog.getByRole("button", { name: "Assignees" }).click();
  await owner.getByRole("option", { name: new RegExp(run.memberName) }).click();
  await owner.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Create task" }).click();
  await owner.getByRole("button", { name: "Open", exact: true }).click();
  await expect(owner.getByRole("heading", { name: taskTitle })).toBeVisible();
});

/** Unread count parsed from the bell's accessible name ("Notifications, 2 unread"); 0 when there is no badge. */
async function unreadCount(page: Page): Promise<number> {
  const label = (await page.getByRole("button", { name: /^Notifications/ }).getAttribute("aria-label")) ?? "";
  return Number(/(\d+) unread/.exec(label)?.[1] ?? 0);
}

test("teammate is notified live of the assignment", async () => {
  // The teammate has been sitting on the Home page the whole time: this only arrives over the WebSocket.
  await expect.poll(() => unreadCount(member), { timeout: 45_000, intervals: [500, 1000] }).toBeGreaterThanOrEqual(1);
  // The toast is short lived and can be gone by now; the sidebar Inbox badge is the durable signal.
  await expect(member.getByRole("link", { name: /^Inbox/ })).toContainText(/\d/);
});

test("owner comments with an @mention of the teammate", async () => {
  const before = await unreadCount(member);
  const editor = owner.getByLabel("New comment");
  await editor.click();
  await owner.keyboard.type("Hi @Mia");
  await owner.getByRole("listbox", { name: "Mention someone" }).getByRole("option", { name: new RegExp(run.memberName) }).click();
  await owner.keyboard.type(` ${commentText}`);
  await owner.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(owner.getByText(commentText)).toBeVisible();
  await expect(owner.getByRole("link", { name: `@${run.memberName}` }).or(owner.getByText(`@${run.memberName}`)).first()).toBeVisible();

  // The mention reaches the teammate live: the bell count goes up without a reload.
  await expect.poll(() => unreadCount(member), { timeout: 45_000, intervals: [500, 1000] }).toBeGreaterThan(before);
});

test("teammate sees the assignment and the mention in the Inbox", async () => {
  await member.getByRole("link", { name: /^Inbox/ }).click();
  await expect(member).toHaveURL(/\/inbox/);
  await expect(member.getByText(taskTitle).first()).toBeVisible();
  await expect(member.getByText(new RegExp(run.ownerName)).first()).toBeVisible();
});

test("teammate sends a direct message and the owner receives it live", async () => {
  await member.getByRole("button", { name: "New message" }).click();
  await member.getByRole("dialog", { name: "New direct message" }).getByRole("option", { name: new RegExp(run.ownerName) }).click();
  await expect(member).toHaveURL(/\/messages\//);
  const box = member.getByLabel(`Message ${run.ownerName}`);
  await box.fill(dmText);
  await box.press("Enter");
  await expect(member.getByText(dmText).first()).toBeVisible();

  // The owner is still on the task page: the DM shows up as a toast and a bell badge.
  await expect(owner.getByText(dmText).first()).toBeVisible({ timeout: 45_000 });
});

test("owner opens the conversation and sees the message in the thread", async () => {
  await owner.getByRole("button", { name: "Open", exact: true }).last().click();
  await expect(owner).toHaveURL(/\/messages\//);
  await expect(owner.getByText(dmText).first()).toBeVisible();
});

test("live chat: a reply appears for the teammate without a reload and the receipt flips to seen", async () => {
  test.setTimeout(120_000);
  const replyText = `Reply from owner ${run.ts}`;
  // The teammate has the conversation open (they sent the DM there); the owner has it open too.
  await expect(member).toHaveURL(/\/messages\//);
  const ownerBox = owner.getByLabel(`Message ${run.memberName}`);
  await ownerBox.fill(replyText);
  await ownerBox.press("Enter");

  // No page.reload() anywhere: the socket delivers it.
  await expect(member.getByText(replyText).first()).toBeVisible({ timeout: 30_000 });

  // The owner's message shows one tick (sent) until the teammate has read it, then two coloured ticks (seen).
  // The teammate's page is visible and focused, so it marks the conversation read on arrival.
  const row = owner.locator("[data-message-id]").filter({ hasText: replyText });
  await expect(row.getByRole("img", { name: "Seen" })).toBeVisible({ timeout: 30_000 });
});

test("teammate signs out, a wrong password is refused, then signing in again needs no code", async () => {
  await member.getByRole("button", { name: "Account menu" }).click();
  await member.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(member).toHaveURL(/\/login/);

  await member.getByLabel("Email").fill(run.memberEmail);
  await member.getByLabel("Password", { exact: true }).fill(`${run.password}-wrong`);
  await member.getByRole("button", { name: "Sign in" }).click();
  await expect(member.getByText("That email and password don't match")).toBeVisible();
  await expect(member.getByRole("heading", { name: "Check your email" })).toHaveCount(0);

  await member.getByLabel("Password", { exact: true }).fill(run.password);
  await member.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(member);
  await expect(member.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});

test("owner signs out and signs in again with password and a fresh emailed code", async () => {
  await owner.getByRole("button", { name: "Account menu" }).click();
  await owner.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(owner).toHaveURL(/\/login/);

  const since = logSize();
  await owner.getByLabel("Email").fill(run.ownerEmail);
  await owner.getByLabel("Password", { exact: true }).fill(run.password);
  await owner.getByRole("button", { name: "Sign in" }).click();
  await expect(owner.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await enterCode(owner, await waitForSignInCode(run.ownerEmail, since));
  await expectSignedIn(owner);
});

test("settings shows what can be delivered and a test explains what is not set up", async () => {
  await owner.goto("/settings?tab=notifications");
  const panel = owner.getByRole("region", { name: "Delivery" });
  await expect(panel).toBeVisible();
  // in-app is always on
  await expect(panel.getByText("Always on")).toBeVisible();
  // the e2e API runs without SMTP and Firebase, so the panel must say so plainly
  await expect(panel.getByText("Not set up").first()).toBeVisible();

  await panel.getByRole("button", { name: "Send me a test" }).click();
  // nothing can be delivered here: each channel reports why, instead of failing silently
  await expect(panel.getByText("Test:")).toHaveCount(2);
  await expect(panel.getByText("Not set up on the server")).toHaveCount(2);
});
