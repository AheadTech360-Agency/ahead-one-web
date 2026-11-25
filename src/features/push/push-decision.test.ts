import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidePushLogin, type PushLoginInput } from "./push-decision.ts";

const base: PushLoginInput = { available: true, permission: "default", enabled: false, freshLogin: true };

describe("decidePushLogin", () => {
  it("offers the dialog when permission is undecided", () => {
    assert.equal(decidePushLogin(base), "offer");
  });
  it("registers silently when already granted without a token", () => {
    assert.equal(decidePushLogin({ ...base, permission: "granted" }), "silent-register");
  });
  it("shows the blocked notice when denied", () => {
    assert.equal(decidePushLogin({ ...base, permission: "denied" }), "denied-notice");
  });
  it("does nothing when already enabled", () => {
    assert.equal(decidePushLogin({ ...base, permission: "granted", enabled: true }), "none");
  });
  it("does nothing once this sign-in was handled", () => {
    assert.equal(decidePushLogin({ ...base, freshLogin: false }), "none");
    assert.equal(decidePushLogin({ ...base, permission: "denied", freshLogin: false }), "none");
  });
  it("does nothing when push is unavailable or unsupported", () => {
    assert.equal(decidePushLogin({ ...base, available: false }), "none");
    assert.equal(decidePushLogin({ ...base, permission: "unsupported" }), "none");
  });
});
