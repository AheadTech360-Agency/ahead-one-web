import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  BARS,
  MAX_SECS,
  checkVoiceUpload,
  clock,
  createExclusive,
  elapsedMs,
  isPlayedByOthers,
  isValidWaveform,
  micIsOpen,
  peakBars,
  pickRecordingMime,
  playerInitial,
  playerReducer,
  recorderInitial,
  recorderReducer,
  remainingSecs,
  scaleToPeak,
  seekPosition,
  shouldReportPlayed,
  showUnplayedDot,
  urlNeedsRefresh,
  voiceLabel,
  withPlayed,
  type RecorderEvent,
  type RecorderState,
} from "./logic.ts";

const run = (events: RecorderEvent[], from: RecorderState = recorderInitial) => events.reduce(recorderReducer, from);

describe("peakBars", () => {
  it("always returns 64 integers 0..255", () => {
    for (const n of [0, 1, 10, 64, 65, 1000, 48000]) {
      const samples = Array.from({ length: n }, (_, i) => Math.sin(i) * 0.7);
      const bars = peakBars(samples);
      assert.equal(bars.length, BARS);
      assert.ok(isValidWaveform(bars), `n=${n}`);
    }
  });
  it("takes the peak of each slice, not the average", () => {
    const s = new Array(640).fill(0);
    s[5] = 1; // one spike in the first slice of ten
    const bars = peakBars(s);
    assert.equal(bars[0], 255);
    assert.equal(bars[1], 0);
  });
  it("uses absolute values, clamps and ignores junk", () => {
    const bars = peakBars([-0.5, 3, NaN, Infinity], 4);
    assert.deepEqual(bars, [128, 255, 0, 0]);
  });
  it("empty input is flat silence", () => {
    assert.deepEqual(peakBars([]), new Array(64).fill(0));
  });
  it("scaleToPeak lifts quiet audio and leaves silence alone", () => {
    const q = scaleToPeak([0, 10, 20]);
    assert.equal(Math.max(...q), 255);
    assert.deepEqual(scaleToPeak([0, 0]), [0, 0]);
  });
});

describe("mime and upload checks", () => {
  it("prefers webm opus, falls back to mp4, else null", () => {
    assert.equal(pickRecordingMime(() => true), "audio/webm;codecs=opus");
    assert.equal(pickRecordingMime((m) => m === "audio/mp4"), "audio/mp4");
    assert.equal(pickRecordingMime(() => false), null);
  });
  it("validates a voice upload", () => {
    const ok = { mime: "audio/webm;codecs=opus", size: 1000, durationSecs: 5, waveform: new Array(64).fill(3) };
    assert.equal(checkVoiceUpload(ok), null);
    assert.ok(checkVoiceUpload({ ...ok, mime: "video/webm" }));
    assert.ok(checkVoiceUpload({ ...ok, size: 9 * 1024 * 1024 }));
    assert.ok(checkVoiceUpload({ ...ok, durationSecs: 0.5 }));
    assert.ok(checkVoiceUpload({ ...ok, durationSecs: 301 }));
    assert.ok(checkVoiceUpload({ ...ok, waveform: [1, 2] }));
    assert.ok(checkVoiceUpload({ ...ok, waveform: new Array(64).fill(256) }));
  });
  it("formats time and previews", () => {
    assert.equal(clock(23), "0:23");
    assert.equal(clock(83.9), "1:23");
    assert.equal(clock(-5), "0:00");
    assert.equal(voiceLabel(23), "Voice message (0:23)");
    assert.equal(voiceLabel(null), "Voice message");
  });
});

describe("recorder state machine", () => {
  it("records, pauses without counting paused time, and sends", () => {
    let s = run([{ type: "start" }, { type: "granted", now: 1000 }]);
    assert.equal(s.phase, "recording");
    s = run([{ type: "pause", now: 3000 }], s); // 2 s recorded
    assert.equal(s.phase, "paused");
    assert.equal(elapsedMs(s, 9000), 2000);
    s = run([{ type: "resume", now: 10000 }, { type: "stop", now: 11000 }], s); // +1 s
    assert.equal(s.phase, "done");
    assert.equal(s.outcome, "send");
    assert.equal(s.accMs, 3000);
  });
  it("under one second is discarded", () => {
    const s = run([{ type: "start" }, { type: "granted", now: 0 }, { type: "stop", now: 999 }]);
    assert.equal(s.outcome, "discarded");
    const t = run([{ type: "start" }, { type: "granted", now: 0 }, { type: "stop", now: 1000 }]);
    assert.equal(t.outcome, "send");
  });
  it("stops itself at 5 minutes and counts down", () => {
    let s = run([{ type: "start" }, { type: "granted", now: 0 }]);
    assert.equal(remainingSecs(s, 270_000), 30);
    s = run([{ type: "tick", now: 299_999 }], s);
    assert.equal(s.phase, "recording");
    s = run([{ type: "tick", now: 300_500 }], s);
    assert.equal(s.phase, "done");
    assert.equal(s.autoStopped, true);
    assert.equal(s.outcome, "send");
    assert.equal(s.accMs, MAX_SECS * 1000);
  });
  it("cancel releases the mic from every live phase", () => {
    for (const events of [
      [{ type: "start" }],
      [{ type: "start" }, { type: "granted", now: 0 }],
      [{ type: "start" }, { type: "granted", now: 0 }, { type: "pause", now: 5 }],
    ] as RecorderEvent[][]) {
      const live = run(events);
      assert.equal(micIsOpen(live), true);
      const s = run([{ type: "cancel" }], live);
      assert.equal(micIsOpen(s), false);
      assert.equal(s.outcome, "cancelled");
    }
  });
  it("permission denied and unsupported are terminal until retried", () => {
    let s = run([{ type: "start" }, { type: "denied" }]);
    assert.equal(s.phase, "denied");
    assert.equal(micIsOpen(s), false);
    s = run([{ type: "start" }], s);
    assert.equal(s.phase, "requesting");
    assert.equal(run([{ type: "unsupported" }]).phase, "unsupported");
  });
  it("ignores events that do not fit the phase", () => {
    assert.equal(run([{ type: "stop", now: 1 }]).phase, "idle");
    assert.equal(run([{ type: "pause", now: 1 }]).phase, "idle");
    assert.equal(run([{ type: "granted", now: 1 }]).phase, "idle");
    const rec = run([{ type: "start" }, { type: "granted", now: 0 }]);
    assert.equal(run([{ type: "start" }], rec).phase, "recording");
  });
  it("a fake interval drives ticks to the automatic stop", () => {
    mock.timers.enable({ apis: ["setInterval", "Date"] });
    try {
      let s = run([{ type: "start" }, { type: "granted", now: Date.now() }]);
      const id = setInterval(() => {
        s = recorderReducer(s, { type: "tick", now: Date.now() });
      }, 250);
      mock.timers.tick(299_000);
      assert.equal(s.phase, "recording");
      mock.timers.tick(1_500);
      clearInterval(id);
      assert.equal(s.phase, "done");
      assert.equal(s.autoStopped, true);
    } finally {
      mock.timers.reset();
    }
  });
});

describe("player state machine", () => {
  it("play, ready, time, pause, ended", () => {
    let s = playerInitial(23);
    s = playerReducer(s, { type: "play" });
    assert.equal(s.phase, "loading");
    s = playerReducer(s, { type: "ready" });
    s = playerReducer(s, { type: "time", secs: 4.2 });
    assert.equal(s.position, 4.2);
    s = playerReducer(s, { type: "pause" });
    assert.equal(s.phase, "paused");
    s = playerReducer(s, { type: "time", secs: 9 }); // ignored while paused
    assert.equal(s.position, 4.2);
    s = playerReducer(s, { type: "ended" });
    assert.deepEqual([s.phase, s.position], ["paused", 0]);
  });
  it("seek clamps, speed cycles 1x 1.5x 2x", () => {
    let s = playerInitial(10);
    s = playerReducer(s, { type: "seek", secs: 99 });
    assert.equal(s.position, 10);
    s = playerReducer(s, { type: "seek", secs: -3 });
    assert.equal(s.position, 0);
    const speeds = [1, 2, 3, 4].map(() => (s = playerReducer(s, { type: "speed" })).speed);
    assert.deepEqual(speeds, [1.5, 2, 1, 1.5]);
  });
  it("errors and offline are distinct, and play retries", () => {
    let s = playerReducer(playerInitial(5), { type: "fail", offline: true });
    assert.equal(s.phase, "offline");
    s = playerReducer(s, { type: "play" });
    assert.equal(s.phase, "loading");
    s = playerReducer(s, { type: "fail", offline: false });
    assert.equal(s.phase, "error");
  });
  it("seekPosition maps pointer to time and guards zero width", () => {
    assert.equal(seekPosition(150, 100, 200, 20), 5);
    assert.equal(seekPosition(0, 100, 200, 20), 0);
    assert.equal(seekPosition(999, 100, 200, 20), 20);
    assert.equal(seekPosition(150, 100, 0, 20), 0);
  });
  it("refreshes an expired signed URL", () => {
    assert.equal(urlNeedsRefresh(null, 0), true);
    assert.equal(urlNeedsRefresh(1000, 1000 + 44_000), false);
    assert.equal(urlNeedsRefresh(1000, 1000 + 45_000), true);
  });
});

describe("played tracking and one player at a time", () => {
  it("reports played once, only for others' unplayed messages", () => {
    const base = { mine: false, playedBy: [] as string[], meId: "me", alreadySent: false };
    assert.equal(shouldReportPlayed(base), true);
    assert.equal(shouldReportPlayed({ ...base, alreadySent: true }), false);
    assert.equal(shouldReportPlayed({ ...base, mine: true }), false);
    assert.equal(shouldReportPlayed({ ...base, playedBy: ["me"] }), false);
    assert.equal(shouldReportPlayed({ ...base, meId: undefined }), false);
  });
  it("unplayed dot and blue mic", () => {
    assert.equal(showUnplayedDot({ mine: false, playedBy: [], meId: "me" }), true);
    assert.equal(showUnplayedDot({ mine: false, playedBy: ["me"], meId: "me" }), false);
    assert.equal(showUnplayedDot({ mine: true, playedBy: [], meId: "me" }), false);
    assert.equal(isPlayedByOthers({ mine: true, playedBy: ["u2"], meId: "me" }), true);
    assert.equal(isPlayedByOthers({ mine: true, playedBy: ["me"], meId: "me" }), false);
    assert.equal(isPlayedByOthers({ mine: false, playedBy: ["u2"], meId: "me" }), false);
    assert.deepEqual(withPlayed(["a"], "a"), ["a"]);
    assert.deepEqual(withPlayed(["a"], "b"), ["a", "b"]);
  });
  it("claiming stops the previous player, once", () => {
    const ex = createExclusive();
    const stops: string[] = [];
    ex.claim("a", () => stops.push("a"));
    ex.claim("a", () => stops.push("a2")); // same player re-claims: no stop
    ex.claim("b", () => stops.push("b"));
    assert.deepEqual(stops, ["a2"]);
    assert.equal(ex.active(), "b");
    ex.release("a"); // not the active one: ignored
    assert.equal(ex.active(), "b");
    ex.release("b");
    assert.equal(ex.active(), null);
  });
});
