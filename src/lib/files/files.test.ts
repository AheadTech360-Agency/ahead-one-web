import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFilesQuery,
  daysUntil,
  expiryLabel,
  expiryState,
  filtersFromParams,
  hasActiveFilters,
  nextCursor,
  paramsFromFilters,
} from "./files-query.ts";
import { checkFile, maxBytesFor, mimeForFile, MAX_FILE_BYTES, MAX_MEDIA_BYTES } from "./limits.ts";
import {
  capReached,
  durationSecs,
  formatClock,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_SECS,
  pickRecordingMime,
  recordingFilename,
  unsupportedReason,
  uploadMime,
  VIDEO_BPS,
  VIDEO_CONSTRAINTS,
  AUDIO_BPS,
} from "./recording.ts";

describe("recording caps", () => {
  it("keeps going below both caps", () => {
    assert.equal(capReached(30_000, 1_000_000), null);
  });
  it("stops at ten minutes", () => {
    assert.equal(capReached(MAX_RECORDING_SECS * 1000, 0), "time");
  });
  it("stops at the size cap, below the API's 100 MB", () => {
    assert.equal(capReached(1000, MAX_RECORDING_BYTES), "size");
    assert.ok(MAX_RECORDING_BYTES < MAX_MEDIA_BYTES);
  });
  it("reports time first when both are hit", () => {
    assert.equal(capReached(MAX_RECORDING_SECS * 1000, MAX_RECORDING_BYTES), "time");
  });
  it("the bitrate lets a full ten minutes fit under the size cap", () => {
    const bytes = ((VIDEO_BPS + AUDIO_BPS) / 8) * MAX_RECORDING_SECS;
    assert.ok(bytes < MAX_RECORDING_BYTES * 0.95, "keeps at least 5% margin under the byte cap");
  });
  it("captures at 720p and a modest frame rate", () => {
    assert.equal(VIDEO_CONSTRAINTS.width.max, 1280);
    assert.equal(VIDEO_CONSTRAINTS.height.max, 720);
    assert.ok(VIDEO_CONSTRAINTS.frameRate.max <= 24);
  });
  it("duration is clamped to the API range 1..600", () => {
    assert.equal(durationSecs(0), 1);
    assert.equal(durationSecs(400), 1);
    assert.equal(durationSecs(5_400), 5);
    assert.equal(durationSecs(999_999_999), 600);
  });
  it("formats the clock", () => {
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(65_900), "1:05");
    assert.equal(formatClock(600_000), "10:00");
  });
});

describe("recording mime", () => {
  it("prefers vp9, then falls back", () => {
    assert.equal(pickRecordingMime(() => true), "video/webm;codecs=vp9,opus");
    assert.equal(pickRecordingMime((t) => t === "video/webm"), "video/webm");
    assert.equal(pickRecordingMime((t) => t.startsWith("video/mp4")), "video/mp4;codecs=avc1,mp4a.40.2");
    assert.equal(pickRecordingMime(() => false), null);
  });
  it("sends the base type without codecs", () => {
    assert.equal(uploadMime("video/webm;codecs=vp9,opus"), "video/webm");
    assert.equal(uploadMime("video/mp4;codecs=avc1"), "video/mp4");
    assert.equal(uploadMime(""), "video/webm");
  });
  it("names files safely", () => {
    assert.equal(recordingFilename("Q3 / launch", "video/webm"), "Q3 - launch.webm");
    assert.equal(recordingFilename("   ", "video/mp4;codecs=avc1"), "Screen recording.mp4");
  });
  it("explains unsupported environments", () => {
    const base = { hasDisplayMedia: true, hasMediaRecorder: true, userAgent: "Chrome", maxTouchPoints: 0, platform: "Win32" };
    assert.equal(unsupportedReason(base), null);
    assert.match(unsupportedReason({ ...base, userAgent: "iPhone Safari" }) ?? "", /desktop/);
    assert.match(unsupportedReason({ ...base, platform: "MacIntel", maxTouchPoints: 5 }) ?? "", /desktop/);
    assert.match(unsupportedReason({ ...base, hasDisplayMedia: false }) ?? "", /can't record/);
  });
});

describe("upload limits", () => {
  const f = (name: string, type: string, size: number) => ({ name, type, size });
  it("allows 25 MB for documents and 100 MB for media", () => {
    assert.equal(maxBytesFor("application/pdf"), MAX_FILE_BYTES);
    assert.equal(maxBytesFor("video/webm"), MAX_MEDIA_BYTES);
    assert.equal(maxBytesFor("audio/mpeg"), MAX_MEDIA_BYTES);
  });
  it("accepts a 60 MB video but not a 60 MB PDF", () => {
    assert.equal(checkFile(f("a.mp4", "video/mp4", 60 * 1024 * 1024)), null);
    assert.match(checkFile(f("a.pdf", "application/pdf", 60 * 1024 * 1024)) ?? "", /25 MB/);
  });
  it("rejects unknown types, empty files and bad names", () => {
    assert.match(checkFile(f("a.exe", "application/x-msdownload", 10)) ?? "", /can't be attached/);
    assert.match(checkFile(f("a.png", "image/png", 0)) ?? "", /empty/);
    assert.match(checkFile(f("a/b.png", "image/png", 10)) ?? "", /Rename/);
  });
  it("falls back to the extension when the browser gives no type", () => {
    assert.equal(mimeForFile({ name: "clip.MOV", type: "" }), "video/quicktime");
    assert.equal(mimeForFile({ name: "x.zip", type: "application/x-zip-compressed" }), "application/zip");
    assert.equal(mimeForFile({ name: "rec.webm", type: "video/webm;codecs=vp9" }), "video/webm");
  });
});

describe("files query", () => {
  const empty = { q: "", type: "", source: "", uploader: "" } as const;
  it("omits empty filters", () => {
    assert.deepEqual(buildFilesQuery({ ...empty }), {
      q: undefined,
      type: undefined,
      source: undefined,
      uploader: undefined,
      conversation_id: undefined,
      project_id: undefined,
      cursor: undefined,
      limit: 40,
    });
  });
  it("passes filters, conversation and cursor through", () => {
    const q = buildFilesQuery({ ...empty, q: " brief ", type: "video", source: "recordings", conversationId: "c1" }, "last-id", 20);
    assert.equal(q.q, "brief");
    assert.equal(q.type, "video");
    assert.equal(q.source, "recordings");
    assert.equal(q.conversation_id, "c1");
    assert.equal(q.cursor, "last-id");
    assert.equal(q.limit, 20);
  });
  it("round-trips URL params and drops invalid values", () => {
    const f = filtersFromParams(new URLSearchParams("q=logo&type=image&source=chats&uploader=11111111-1111-1111-1111-111111111111"));
    assert.equal(paramsFromFilters(f), "?q=logo&type=image&source=chats&uploader=11111111-1111-1111-1111-111111111111");
    const bad = filtersFromParams(new URLSearchParams("type=exe&source=nope&uploader=../x"));
    assert.deepEqual(bad, { q: "", type: "", source: "", uploader: "" });
    assert.equal(paramsFromFilters(bad), "");
  });
  it("knows when filters are active", () => {
    assert.equal(hasActiveFilters({ ...empty }), false);
    assert.equal(hasActiveFilters({ ...empty, q: "x" }), true);
    assert.equal(hasActiveFilters({ ...empty, source: "tasks" }), false);
  });
  it("paginates by last id only on a full page", () => {
    const page = [{ id: "a" }, { id: "b" }];
    assert.equal(nextCursor(page, (x) => x.id, 2), "b");
    assert.equal(nextCursor(page, (x) => x.id, 3), undefined);
    assert.equal(nextCursor([], (x: { id: string }) => x.id, 1), undefined);
  });
});

describe("expiry", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  it("counts days and warns within 14", () => {
    assert.equal(daysUntil("2026-12-05T12:00:00Z", now), 10);
    assert.deepEqual(expiryState("2026-12-09T12:00:00Z", now), { days: 14, soon: true });
    assert.deepEqual(expiryState("2026-12-10T12:00:00Z", now), { days: 15, soon: false });
    assert.equal(daysUntil("2026-11-01T00:00:00Z", now), 0);
  });
  it("labels", () => {
    assert.equal(expiryLabel(0), "Expires today");
    assert.equal(expiryLabel(1), "Expires tomorrow");
    assert.equal(expiryLabel(9), "Expires in 9 days");
  });
});
