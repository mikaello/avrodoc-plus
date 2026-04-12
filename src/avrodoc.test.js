import { createAvroDoc } from "./avrodoc.js";
import { readFileSync, unlinkSync } from "fs";
import { test, after, describe } from "node:test";
import assert from "node:assert/strict";

describe("test HTML generation", () => {
  const testFile = "nodeTest.html";

  after(() => {
    unlinkSync(testFile);
  });

  test("avrodoc creates documentation", async () => {
    await createAvroDoc(
      "Test: Avrodoc",
      [],
      ["./schemata/example.avsc"],
      testFile,
    );

    assert.ok(readFileSync(testFile, "utf-8").includes('data-route="#/"'));
  });
});
