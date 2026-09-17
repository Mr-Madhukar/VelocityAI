import assert from "node:assert/strict";
import test from "node:test";

import { clampScore, scoreFromCriteria, type CriterionStatus } from "./code-review";

const crit = (status: CriterionStatus) => ({ status });

test("scoreFromCriteria returns null when there are no criteria", () => {
  assert.equal(scoreFromCriteria([]), null);
});

test("scoreFromCriteria scores 100 when every criterion is met", () => {
  assert.equal(scoreFromCriteria([crit("met"), crit("met"), crit("met")]), 100);
});

test("scoreFromCriteria scores 0 when nothing is met", () => {
  assert.equal(scoreFromCriteria([crit("not_met"), crit("not_met")]), 0);
});

test("scoreFromCriteria gives partial credit (this is the fix for the constant 60/100)", () => {
  // 1 met + 1 partial + 2 not_met = 1.5 / 4 = 37.5 → 38
  assert.equal(
    scoreFromCriteria([crit("met"), crit("partial"), crit("not_met"), crit("not_met")]),
    38,
  );
});

test("scoreFromCriteria weights partials as half", () => {
  assert.equal(scoreFromCriteria([crit("partial"), crit("partial")]), 50);
});

test("clampScore rounds and bounds to 0..100", () => {
  assert.equal(clampScore(73.4), 73);
  assert.equal(clampScore(73.6), 74);
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(150), 100);
});

test("clampScore treats non-finite input as 0 (safe floor for garbage)", () => {
  assert.equal(clampScore(Number.NaN), 0);
  assert.equal(clampScore(Number.POSITIVE_INFINITY), 0);
});
