import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conversationWithMessage, conversationWithRead, mergeReadState, titleWithCount, tombstoneInPages, totalUnread, upsertInPages } from "./cache-patch.ts";
import { dmReceipt, latestOwn, readerIds, shouldMarkRead } from "./receipts.ts";

const m = (id: string, extra: { deleted?: boolean; body?: string; author?: { id: string } } = {}) => ({ id, body: id, attachments: [] as unknown[], author: { id: "u" }, ...extra });

describe("cache patching", () => {
  it("inserts a new message newest first and replaces an edit in place", () => {
    const pages = [{ items: [m("c"), m("a")] }, { items: [m("0")] }];
    const ins = upsertInPages(pages, m("d"));
    assert.deepEqual(ins[0].items.map((x) => x.id), ["d", "c", "a"]);
    const edit = upsertInPages(pages, m("c", { body: "edited" }));
    assert.equal(edit[0].items[0].body, "edited");
    assert.equal(edit[0].items.length, 2);
    assert.deepEqual(upsertInPages([], m("x")), []);
  });
  it("out of order arrival stays sorted", () => {
    const out = upsertInPages([{ items: [m("c"), m("a")] }], m("b"));
    assert.deepEqual(out[0].items.map((x) => x.id), ["c", "b", "a"]);
  });
  it("delete leaves a tombstone", () => {
    const out = tombstoneInPages([{ items: [m("c"), m("a")] }], "c");
    assert.equal(out[0].items[0].deleted, true);
    assert.equal(out[0].items[0].body, "");
    assert.equal(out[0].items[1].deleted, undefined);
  });
  const conv = { id: "k", last_message: m("b"), unread_count: 2, last_read_message_id: "a" };
  it("a message from someone else raises the badge unless the chat is being read", () => {
    assert.equal(conversationWithMessage(conv, m("c"), false, false).unread_count, 3);
    assert.equal(conversationWithMessage(conv, m("c"), false, true).unread_count, 0);
    const mine = conversationWithMessage(conv, m("c"), true, false);
    assert.equal(mine.unread_count, 0);
    assert.equal(mine.last_read_message_id, "c");
  });
  it("an older message does not change the preview", () => {
    assert.equal(conversationWithMessage(conv, m("a"), false, false), conv);
  });
  it("own read position is monotonic and clears the badge only at the newest", () => {
    assert.equal(conversationWithRead(conv, "a").last_read_message_id, "a");
    assert.equal(conversationWithRead(conv, "a").unread_count, 2);
    const r = conversationWithRead(conv, "b");
    assert.equal(r.unread_count, 0);
    assert.equal(r.last_read_message_id, "b");
    assert.equal(conversationWithRead({ ...conv, last_read_message_id: "z" }, "b").last_read_message_id, "z");
  });
  it("other readers merge without going backwards", () => {
    const list = [{ user_id: "x", last_read_message_id: "c" }];
    assert.equal(mergeReadState(list, "x", "b")[0].last_read_message_id, "c");
    assert.equal(mergeReadState(list, "x", "d")[0].last_read_message_id, "d");
    assert.equal(mergeReadState(list, "y", "a").length, 2);
  });
  it("counts unread and builds the tab title", () => {
    assert.equal(totalUnread([{ unread_count: 2 }, { unread_count: 3, muted: true }, { unread_count: 1 }]), 3);
    assert.equal(totalUnread(undefined), 0);
    assert.equal(titleWithCount("Inbox | AheadOne", 3), "(3) Inbox | AheadOne");
    assert.equal(titleWithCount("(3) Inbox | AheadOne", 0), "Inbox | AheadOne");
    assert.equal(titleWithCount("x", 120), "(99+) x");
  });
});

describe("read receipts", () => {
  const states = [
    { user_id: "me", last_read_message_id: "z" },
    { user_id: "p", last_read_message_id: "m5" },
    { user_id: "q", last_read_message_id: null },
    { user_id: "r", last_read_message_id: "m9" },
  ];
  it("DM flips from sent to seen when the other person's position reaches the message", () => {
    assert.equal(dmReceipt("m6", "me", states.slice(0, 2)), "sent");
    assert.equal(dmReceipt("m5", "me", states.slice(0, 2)), "seen");
    assert.equal(dmReceipt("m1", "me", states.slice(0, 2)), "seen");
    assert.equal(dmReceipt("m1", "me", undefined), "sent");
  });
  it("channel readers exclude the sender and people who have not reached it", () => {
    assert.deepEqual(readerIds("m5", "me", states), ["p", "r"]);
    assert.deepEqual(readerIds("m7", "me", states), ["r"]);
    assert.deepEqual(readerIds("m7", "me", undefined), []);
  });
  it("finds the sender's latest undeleted message", () => {
    const list = [m("a", { author: { id: "me" } }), m("c", { author: { id: "me" }, deleted: true }), m("b", { author: { id: "me" } }), m("d")];
    assert.equal(latestOwn(list, "me")?.id, "b");
    assert.equal(latestOwn(list, undefined), undefined);
  });
  const base = { newestId: "m5", lastSent: null, serverRead: "m3", unread: 1, visible: true, focused: true, atBottom: true, isMember: true };
  it("marks read only when visible, focused and at the bottom", () => {
    assert.equal(shouldMarkRead(base), true);
    assert.equal(shouldMarkRead({ ...base, visible: false }), false);
    assert.equal(shouldMarkRead({ ...base, focused: false }), false);
    assert.equal(shouldMarkRead({ ...base, atBottom: false }), false);
    assert.equal(shouldMarkRead({ ...base, isMember: false }), false);
  });
  it("is monotonic and does not repeat", () => {
    assert.equal(shouldMarkRead({ ...base, lastSent: "m5" }), false);
    assert.equal(shouldMarkRead({ ...base, lastSent: "m6" }), false);
    assert.equal(shouldMarkRead({ ...base, lastSent: "m4" }), true);
    assert.equal(shouldMarkRead({ ...base, unread: 0, serverRead: "m5" }), false);
  });
});
