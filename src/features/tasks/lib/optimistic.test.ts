import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendComment, mapPages, moveTaskInPages, patchTaskInPages, settleComment, type CommentPages, type TaskPages } from "./optimistic.ts";

const task = (id: string, extra: object = {}) => ({ id, title: id, ...extra }) as never;
const pages = (...groups: string[][]): TaskPages => ({
  pages: groups.map((g, i) => ({ items: g.map((id) => task(id)), next_cursor: i < groups.length - 1 ? "n" : null })),
  pageParams: groups.map(() => undefined),
});
const ids = (d: TaskPages | undefined) => d?.pages.map((p) => p.items.map((t) => (t as { id: string }).id));

describe("patchTaskInPages", () => {
  it("patches only the matching task and does not mutate the input", () => {
    const before = pages(["a", "b"], ["c"]);
    const after = patchTaskInPages(before, "c", (t) => ({ ...t, title: "new" }));
    assert.equal((after!.pages[1].items[0] as { title: string }).title, "new");
    assert.equal((before.pages[1].items[0] as { title: string }).title, "c");
    assert.equal(after!.pages[0].items[0], before.pages[0].items[0]);
  });
  it("passes undefined through", () => {
    assert.equal(patchTaskInPages(undefined, "a", (t) => t), undefined);
    assert.equal(mapPages(undefined, (x) => x), undefined);
  });
});

describe("moveTaskInPages", () => {
  it("moves after a neighbour, across pages", () => {
    assert.deepEqual(ids(moveTaskInPages(pages(["a", "b"], ["c", "d"]), "a", "c", undefined)), [["b"], ["c", "a", "d"]]);
  });
  it("moves before a neighbour", () => {
    assert.deepEqual(ids(moveTaskInPages(pages(["a", "b", "c"]), "c", undefined, "a")), [["c", "a", "b"]]);
  });
  it("moves to the very top when after_id is null", () => {
    assert.deepEqual(ids(moveTaskInPages(pages(["a", "b"], ["c"]), "c", null, undefined)), [["c", "a", "b"], []]);
  });
  it("falls back to the end when the anchor is not loaded", () => {
    assert.deepEqual(ids(moveTaskInPages(pages(["a", "b"]), "a", "zzz", undefined)), [["b", "a"]]);
  });
  it("returns the same pages when the task is not cached, so a rollback snapshot stays valid", () => {
    const d = pages(["a"]);
    assert.equal(moveTaskInPages(d, "missing", "a", undefined), d);
  });
});

describe("comment helpers", () => {
  const c = (id: string) => ({ id, task_id: "t", author: null, body: {}, created_at: "", edited_at: null }) as never;

  it("appends to the last page and creates a page when the thread is empty", () => {
    const d: CommentPages = { pages: [{ items: [c("1")], next_cursor: "x" }, { items: [c("2")], next_cursor: null }], pageParams: [undefined, "x"] };
    const out = appendComment(d, c("3"));
    assert.deepEqual(out.pages.map((p) => p.items.length), [1, 2]);
    assert.equal(appendComment(undefined, c("1")).pages[0].items.length, 1);
  });
  it("replaces the temporary comment with the server's, leaving others alone", () => {
    const d: CommentPages = { pages: [{ items: [c("1"), c("pending-9")], next_cursor: null }], pageParams: [undefined] };
    const out = settleComment(d, "pending-9", c("real"));
    assert.deepEqual(out!.pages[0].items.map((x) => (x as { id: string }).id), ["1", "real"]);
    assert.equal(settleComment(undefined, "p", c("r")), undefined);
  });
});
