import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_AUTH_CALLBACK, getSafeCallbackPath } from "./index";

test("getSafeCallbackPath keeps a same-origin relative path", () => {
  assert.equal(getSafeCallbackPath("/dashboard"), "/dashboard");
  assert.equal(getSafeCallbackPath("/features/new"), "/features/new");
  assert.equal(getSafeCallbackPath("/settings/team?tab=invites"), "/settings/team?tab=invites");
});

test("getSafeCallbackPath rejects protocol-relative URLs (open-redirect guard)", () => {
  assert.equal(getSafeCallbackPath("//evil.com"), DEFAULT_AUTH_CALLBACK);
  assert.equal(getSafeCallbackPath("//evil.com/path"), DEFAULT_AUTH_CALLBACK);
});

test("getSafeCallbackPath rejects absolute and non-path URLs", () => {
  assert.equal(getSafeCallbackPath("https://evil.com"), DEFAULT_AUTH_CALLBACK);
  assert.equal(getSafeCallbackPath("http://localhost/dashboard"), DEFAULT_AUTH_CALLBACK);
  assert.equal(getSafeCallbackPath("relative/path"), DEFAULT_AUTH_CALLBACK);
  assert.equal(getSafeCallbackPath(""), DEFAULT_AUTH_CALLBACK);
});

test("getSafeCallbackPath falls back when nothing is provided", () => {
  assert.equal(getSafeCallbackPath(null), DEFAULT_AUTH_CALLBACK);
  assert.equal(getSafeCallbackPath(undefined), DEFAULT_AUTH_CALLBACK);
});
