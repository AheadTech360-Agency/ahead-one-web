import assert from "node:assert/strict";
import { test } from "node:test";
import type { TreeSpace } from "@/lib/api/types";
import {
  canHavePersonal,
  clientSpaces,
  findPersonal,
  isPersonalProject,
  personalPeople,
  personalProjectIds,
  shareConfirmCopy,
  shareTargets,
  showsLockBadge,
  withPersonalSpace,
} from "./logic.ts";

const space = (id: string, personal: boolean, archived = false): TreeSpace => ({
  id,
  name: personal ? "My private tasks" : `Client ${id}`,
  color: "#123456",
  archived,
  personal,
  projects: [
    {
      id: `p-${id}`,
      name: `Project ${id}`,
      color: "#123456",
      visibility: "private",
      archived: false,
      lists: [{ id: `l-${id}`, name: "Tasks" }],
    },
  ],
});

const tree = [space("a", false), space("me", true), space("b", false, true)];

test("who can have a personal project", () => {
  for (const r of ["owner", "admin", "management", "member"] as const) assert.equal(canHavePersonal(r), true);
  assert.equal(canHavePersonal("guest"), false);
  assert.equal(canHavePersonal(undefined), false);
});

test("the personal space is found and kept out of client lists", () => {
  assert.equal(findPersonal(tree)?.list.id, "l-me");
  assert.deepEqual(clientSpaces(tree).map((s) => s.id), ["a", "b"]);
  assert.equal(findPersonal([space("a", false)]), null);
  assert.equal(findPersonal(undefined), null);
});

test("personal project ids and lock badge", () => {
  const ids = personalProjectIds(tree);
  assert.deepEqual([...ids], ["p-me"]);
  assert.equal(isPersonalProject(tree, "p-me"), true);
  assert.equal(isPersonalProject(tree, "p-a"), false);
  assert.equal(isPersonalProject(tree, undefined), false);
  assert.equal(showsLockBadge("p-me", ids), true);
  assert.equal(showsLockBadge("p-a", ids), false);
});

test("only the owner can be assigned in a personal project", () => {
  const me = { id: "u1", full_name: "A", email: "a@x.test", avatar_url: null };
  assert.deepEqual(personalPeople(me), [me]);
  assert.deepEqual(personalPeople(undefined), []);
});

test("share targets exclude the personal space and archived clients", () => {
  assert.deepEqual(shareTargets(tree).map((t) => t.value), ["l-a"]);
});

test("the share confirmation names the project and the consequence", () => {
  const c = shareConfirmCopy("Plan Q3", "Acme Launch");
  assert.match(c.body, /visible to everyone who can see that project/);
  assert.match(c.confirm, /Acme Launch/);
  assert.ok(!(c.body + c.title).includes("—"));
});

test("withPersonalSpace is idempotent and puts the space first", () => {
  const pp = { project: { id: "p-me", color: "#fff" }, space_id: "me", list_id: "l-me" };
  const once = withPersonalSpace([space("a", false)], pp);
  assert.equal(once[0]!.personal, true);
  assert.equal(withPersonalSpace(once, pp).length, 2);
  assert.equal(findPersonal(once)?.list.id, "l-me");
});
