import assert from "node:assert/strict";
import test from "node:test";

import { parseGitHubInstallationCallback } from "./installation";

test("parseGitHubInstallationCallback extracts installation id and setup action", () => {
  const params = new URLSearchParams("installation_id=12345&setup_action=install");

  assert.deepEqual(parseGitHubInstallationCallback(params), {
    installationId: "12345",
    setupAction: "install",
  });
});

test("parseGitHubInstallationCallback returns null setup action when absent", () => {
  const params = new URLSearchParams("installation_id=999");

  assert.deepEqual(parseGitHubInstallationCallback(params), {
    installationId: "999",
    setupAction: null,
  });
});

test("parseGitHubInstallationCallback returns null without an installation id", () => {
  assert.equal(parseGitHubInstallationCallback(new URLSearchParams("setup_action=install")), null);
  assert.equal(parseGitHubInstallationCallback(new URLSearchParams()), null);
});
