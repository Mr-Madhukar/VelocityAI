import assert from "node:assert/strict";
import test from "node:test";

import { cn } from "./utils";

test("cn joins truthy class names and drops falsy ones", () => {
  assert.equal(cn("a", "b"), "a b");
  assert.equal(cn("a", false, undefined, null, "b"), "a b");
});

test("cn supports conditional object syntax", () => {
  assert.equal(cn("base", { active: true, hidden: false }), "base active");
});

test("cn resolves conflicting tailwind utilities (last wins)", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
  assert.equal(cn("text-sm text-lg"), "text-lg");
  assert.equal(cn("px-2", "p-4"), "p-4");
});
