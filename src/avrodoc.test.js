import { createAvroDoc } from "./avrodoc.js";
import { buildAvroDocContext } from "./schema_parser.js";
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

describe("bare primitive type schema", () => {
  test("resolves a schema file whose entire content is a bare primitive string", () => {
    // A valid Avro schema can be just a primitive type name string like "boolean".
    // readJSON returns the JS string 'boolean' after JSON.parse; parseAvroSchema
    // must not call JSON.parse again on it.
    assert.doesNotThrow(() => {
      buildAvroDocContext([
        { filename: "bare_primitive.avsc", json: "boolean" },
      ]);
    });
  });
});

describe("cross-file type reference ordering", () => {
  test("resolves type references when referencing file sorts before defining file", () => {
    // cross_ref_a_referrer.avsc references com.example.crossref.ZLogLevel
    // cross_ref_z_types.avsc defines ZLogLevel
    // alphabetical order puts the referrer first — this must still work
    const referrerJson = JSON.parse(
      readFileSync("./schemata/cross_ref_a_referrer.avsc", "utf-8"),
    );
    const definesJson = JSON.parse(
      readFileSync("./schemata/cross_ref_z_types.avsc", "utf-8"),
    );

    // Pass schemata in the problematic order (referrer first, definition second)
    assert.doesNotThrow(() => {
      buildAvroDocContext([
        { filename: "cross_ref_a_referrer.avsc", json: referrerJson },
        { filename: "cross_ref_z_types.avsc", json: definesJson },
      ]);
    }, "should resolve cross-file type reference regardless of input order");
  });
});
