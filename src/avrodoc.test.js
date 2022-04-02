import { createAvroDoc } from "./avrodoc.js";
import { readFileSync, unlinkSync } from "fs";

describe("test HTML generation", () => {
  const testFile = "jestTest.html";

  afterAll(() => {
    // Cleanup
    unlinkSync(testFile);
  });

  test("avrodoc creates documentation", async () => {
    await expect(
      createAvroDoc("Test: Avrodoc", [], ["./schemata/example.avsc"], testFile)
    ).resolves.toBeUndefined();

    expect(readFileSync(testFile, "utf-8")).toContain(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Avrodoc</title>'
    );
  });
});
