import assert from "node:assert/strict";
import test from "node:test";

import {
  filePriority,
  isIndexableSourcePath,
  MAX_INDEXABLE_FILE_BYTES,
} from "./repo-index";

test("isIndexableSourcePath keeps real source files", () => {
  assert.equal(isIndexableSourcePath("apps/web/app/page.tsx"), true);
  assert.equal(isIndexableSourcePath("packages/services/shipflow/billing.ts"), true);
  assert.equal(isIndexableSourcePath("README.md"), true);
});

test("isIndexableSourcePath skips vendored/build directories", () => {
  assert.equal(isIndexableSourcePath("node_modules/react/index.js"), false);
  assert.equal(isIndexableSourcePath("apps/web/.next/server/chunk.js"), false);
  assert.equal(isIndexableSourcePath("dist/bundle.js"), false);
  assert.equal(isIndexableSourcePath(".git/config"), false);
});

test("isIndexableSourcePath skips binary/lock/asset extensions", () => {
  assert.equal(isIndexableSourcePath("public/logo.png"), false);
  assert.equal(isIndexableSourcePath("pnpm-lock.yaml.lock"), false);
  assert.equal(isIndexableSourcePath("fonts/Inter.woff2"), false);
  assert.equal(isIndexableSourcePath("build.map"), false);
});

test("isIndexableSourcePath skips files larger than the byte cap", () => {
  assert.equal(isIndexableSourcePath("src/big.ts", MAX_INDEXABLE_FILE_BYTES + 1), false);
  assert.equal(isIndexableSourcePath("src/ok.ts", MAX_INDEXABLE_FILE_BYTES), true);
});

test("isIndexableSourcePath rejects empty paths", () => {
  assert.equal(isIndexableSourcePath(""), false);
});

test("filePriority ranks config/entrypoints above deep app files", () => {
  assert.ok(filePriority("package.json") > filePriority("apps/web/features/x/y/z/util.ts"));
  assert.ok(filePriority("README.md") > filePriority("apps/web/app/(p)/a/b/c.tsx"));
});

test("filePriority ranks shallower files above deeper ones", () => {
  assert.ok(filePriority("src/index.ts") > filePriority("src/a/b/c/d/deep.ts"));
});

test("filePriority demotes tests and type declarations", () => {
  assert.ok(filePriority("src/foo.ts") > filePriority("src/foo.test.ts"));
  assert.ok(filePriority("src/foo.ts") > filePriority("src/foo.d.ts"));
});
