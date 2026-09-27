import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseHTML } from "linkedom";
import { createAvroDoc } from "./avrodoc.js";

const runFile = promisify(execFile);
const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/issue5/", import.meta.url),
);

function assertFooReference(html) {
  const { document } = parseHTML(html);
  const bar = document.querySelector(
    'section[data-route="#/schema/example.com.Bar"]',
  );
  assert.ok(bar, "Bar has a documentation route");
  const field = [...bar.querySelectorAll("tbody tr")].find(
    (row) => row.querySelector(".field")?.textContent.trim() === "fooObject",
  );
  assert.ok(field, "Bar documents fooObject");
  const link = field.querySelector(".type a");
  assert.ok(link, "fooObject links to its named type");
  assert.equal(link.textContent.trim(), "Foo");
  const foo = [...document.querySelectorAll("section[data-route]")].find(
    (section) =>
      section.getAttribute("data-route") === link.getAttribute("href"),
  );
  assert.ok(foo, "the Foo link resolves to a documentation route");
  assert.equal(foo.querySelector(".type-name").textContent.trim(), "Foo");
  assert.deepEqual(
    [...foo.querySelectorAll("td.field")].map((cell) =>
      cell.textContent.trim(),
    ),
    ["value", "history"],
  );
}

for (const filenames of [
  ["foo.avsc", "bar.avsc"],
  ["bar.avsc", "foo.avsc"],
]) {
  test(`issue #5 resolves Foo from Bar with input order ${filenames.join(", ")}`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "avrodoc-issue5-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const output = join(directory, "out.html");

    await createAvroDoc(
      "Issue #5",
      [],
      filenames.map((filename) => join(fixtureDirectory, filename)),
      output,
    );

    assertFooReference(await readFile(output, "utf8"));
  });
}

test("issue #5 resolves references across recursively discovered directories", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "avrodoc-issue5-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "schemas");
  const consumers = join(input, "a-consumers");
  const definitions = join(input, "z-types");
  await mkdir(consumers, { recursive: true });
  await mkdir(definitions, { recursive: true });
  await copyFile(
    join(fixtureDirectory, "bar.avsc"),
    join(consumers, "bar.avsc"),
  );
  await copyFile(
    join(fixtureDirectory, "foo.avsc"),
    join(definitions, "foo.avsc"),
  );
  const output = join(directory, "out.html");

  await runFile(process.execPath, [
    fileURLToPath(new URL("./cli.js", import.meta.url)),
    "--input",
    input,
    "--output",
    output,
  ]);

  assertFooReference(await readFile(output, "utf8"));
});
