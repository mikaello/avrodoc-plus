import { createAvroDoc } from "./avrodoc.js";
import { readFileSync, unlinkSync, existsSync } from "fs";
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

    assert.ok(
      readFileSync(testFile, "utf-8").includes(
        '<!DOCTYPE html><html lang="en">',
      ),
    );
  });
});

describe("cross-file type reference ordering", () => {
  const testFile = "nodeTest_crossref.html";

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  test("generates HTML with cross-file referencing schemata in problematic order", async () => {
    // cross_ref_a_referrer.avsc references com.example.crossref.ZLogLevel
    // cross_ref_z_types.avsc defines ZLogLevel
    // alphabetical order puts the referrer first — HTML must be generated without error
    await assert.doesNotReject(
      createAvroDoc(
        "Test: Cross-ref",
        [],
        [
          "./schemata/cross_ref_a_referrer.avsc",
          "./schemata/cross_ref_z_types.avsc",
        ],
        testFile,
      ),
    );
    // Both schema filenames should be embedded in the generated HTML
    const html = readFileSync(testFile, "utf-8");
    assert.ok(html.includes("cross_ref_a_referrer.avsc"));
    assert.ok(html.includes("cross_ref_z_types.avsc"));
  });
});

describe("bare primitive type schema", () => {
  const testFile = "nodeTest_primitive.html";

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  test("generates HTML for a schema file whose entire content is a bare primitive string", async () => {
    // A valid Avro schema can be just a primitive type name string like "boolean".
    // readJSON returns the JS string 'boolean'; it must be embedded without error.
    await assert.doesNotReject(
      createAvroDoc(
        "Test: Primitive",
        [],
        ["./schemata/bare_primitive.avsc"],
        testFile,
      ),
    );
    assert.ok(
      readFileSync(testFile, "utf-8").includes("bare_primitive.avsc"),
    );
  });
});
