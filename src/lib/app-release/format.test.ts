import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeeAppRelease, formatBytes, formatPublished, isAllowedDownloadUrl, truncateSha } from "./format.ts";

describe("isAllowedDownloadUrl", () => {
  it("accepts https on the R2 endpoint", () => {
    assert.equal(isAllowedDownloadUrl("https://abc123.r2.cloudflarestorage.com/bucket/releases/a.apk?X-Amz-Signature=s"), true);
    assert.equal(isAllowedDownloadUrl("https://ABC.R2.CloudflareStorage.com/x"), true);
    assert.equal(isAllowedDownloadUrl("https://bucket.acct.eu.r2.cloudflarestorage.com/x"), true);
  });
  it("refuses http and other schemes", () => {
    assert.equal(isAllowedDownloadUrl("http://abc.r2.cloudflarestorage.com/x"), false);
    assert.equal(isAllowedDownloadUrl("javascript:alert(1)"), false);
    assert.equal(isAllowedDownloadUrl("data:text/html,hi"), false);
    assert.equal(isAllowedDownloadUrl("//abc.r2.cloudflarestorage.com/x"), false);
  });
  it("refuses other hosts and lookalikes", () => {
    assert.equal(isAllowedDownloadUrl("https://example.com/x"), false);
    assert.equal(isAllowedDownloadUrl("https://r2.cloudflarestorage.com/x"), false);
    assert.equal(isAllowedDownloadUrl("https://evil.com/.r2.cloudflarestorage.com"), false);
    assert.equal(isAllowedDownloadUrl("https://r2.cloudflarestorage.com.evil.com/x"), false);
    assert.equal(isAllowedDownloadUrl("https://evilr2.cloudflarestorage.com/x"), false);
    assert.equal(isAllowedDownloadUrl("https://abc.r2.cloudflarestorage.com@evil.com/x"), false);
    assert.equal(isAllowedDownloadUrl("https://user:pw@abc.r2.cloudflarestorage.com/x"), false);
  });
  it("refuses non-strings and junk", () => {
    for (const v of [undefined, null, 5, {}, "", "not a url"]) assert.equal(isAllowedDownloadUrl(v), false);
  });
});

describe("formatBytes", () => {
  it("scales with binary steps", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatBytes(52_428_800), "50.0 MB");
    assert.equal(formatBytes(48_234_496), "46.0 MB");
    assert.equal(formatBytes(1_610_612_736), "1.5 GB");
  });
  it("handles bad input", () => {
    assert.equal(formatBytes(-1), "Unknown size");
    assert.equal(formatBytes(Number.NaN), "Unknown size");
  });
});

describe("formatPublished", () => {
  it("formats an ISO timestamp", () => {
    assert.equal(formatPublished("2026-11-26T10:00:00Z", "UTC"), "Nov 26, 2026");
    assert.equal(formatPublished("2026-01-05T23:30:00Z", "UTC"), "Jan 5, 2026");
  });
  it("does not throw on junk", () => {
    assert.equal(formatPublished("nope"), "Unknown date");
  });
});

describe("truncateSha", () => {
  const sha = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  it("keeps the first and last 8 characters", () => {
    assert.equal(truncateSha(sha), "01234567…89abcdef");
  });
  it("leaves short values alone", () => {
    assert.equal(truncateSha("abc"), "abc");
  });
});

describe("canSeeAppRelease", () => {
  it("shows to the team roles", () => {
    for (const r of ["owner", "admin", "management", "member"]) assert.equal(canSeeAppRelease(r), true);
  });
  it("hides from guests, unknown and not-yet-loaded roles", () => {
    for (const r of ["guest", "", "viewer", undefined]) assert.equal(canSeeAppRelease(r), false);
  });
});
