import assert from "node:assert/strict";
import { test } from "node:test";

import { shortId, stripAnsi, table } from "./output";

test("shortId returns the first 8 characters", () => {
  assert.equal(shortId("abcdef12-3456-7890-abcd-ef1234567890"), "abcdef12");
});

test("stripAnsi removes SGR color sequences", () => {
  const colored = `${String.fromCharCode(27)}[32mgreen${String.fromCharCode(27)}[39m`;
  assert.equal(stripAnsi(colored), "green");
});

test("table aligns columns ignoring color codes", () => {
  const green = `${String.fromCharCode(27)}[32mok${String.fromCharCode(27)}[39m`;
  const out = table(["A", "B"], [["longvalue", green], ["x", "y"]]);
  const lines = out.split("\n");
  // Header + two rows.
  assert.equal(lines.length, 3);
  // The color code must not push the second column out of alignment: the "y"
  // row's second column starts at the same visual offset as the header's.
  const headerB = stripAnsi(lines[0]!).indexOf("B");
  const rowY = stripAnsi(lines[2]!).indexOf("y");
  assert.equal(headerB, rowY);
});
