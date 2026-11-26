import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNext } from "./safe-next.ts";

describe("safeNext", () => {
  const hostile = [
    "//evil.com",
    "/\\evil.com",
    "/%2f%2fevil",
    "/%2F%2Fevil.com",
    "/%252f%252fevil",
    "https://evil",
    "http://evil.com/x",
    "javascript:alert(1)",
    "data:text/html,x",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\n/evil.com",
    "/ /evil.com",
    "/a b",
    "/..//evil",
    "/a/../..//evil.com",
    "\\\\evil.com",
    "evil.com",
    "",
    "/" + "a".repeat(3000),
    "/\u0000x",
    "/ x",
    "/%0d%0a",
    "/%5cevil.com",
  ];
  for (const h of hostile) {
    it(`falls back for ${JSON.stringify(h.slice(0, 30))}`, () => assert.equal(safeNext(h, "/inbox"), "/inbox"));
  }
  it("keeps legitimate links", () => {
    for (const ok of ["/", "/t/abc", "/messages/123?x=1#y", "/p/a-b/l/c", "/search?q=a%20b", "/inbox"]) assert.equal(safeNext(ok, "/inbox"), ok);
  });
  it("handles null and undefined", () => {
    assert.equal(safeNext(null, "/z"), "/z");
    assert.equal(safeNext(undefined), "/");
  });
  it("is self-contained so the service worker can embed it", () => {
    const src = safeNext.toString();
    const fn = new Function(`return ${src}`)() as typeof safeNext;
    assert.equal(fn("//evil.com", "/inbox"), "/inbox");
    assert.equal(fn("/t/1", "/inbox"), "/t/1");
  });
});
