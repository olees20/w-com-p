import test from "node:test";
import assert from "node:assert/strict";
import { pluralizeForTest } from "@/lib/health-check-report";

test("pluralize handles 0", () => {
  assert.equal(pluralizeForTest(0, "file was", "files were"), "files were");
});

test("pluralize handles 1", () => {
  assert.equal(pluralizeForTest(1, "file was", "files were"), "file was");
});

test("pluralize handles 2", () => {
  assert.equal(pluralizeForTest(2, "file was", "files were"), "files were");
});

