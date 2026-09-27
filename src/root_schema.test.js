import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { topLevelHTML } from "./static_content.js";
import { buildAvroDocContext } from "./schema_parser.js";

const primitives = [
  "null",
  "boolean",
  "int",
  "long",
  "float",
  "double",
  "bytes",
  "string",
];

async function render(schemata) {
  const html = await topLevelHTML("Root schemas", [], { schemata });
  return parseHTML(html).document;
}

function parse(json) {
  return buildAvroDocContext([{ filename: "schema.avsc", json }]);
}

describe("schemas without a record wrapper", () => {
  for (const primitive of primitives) {
    for (const json of [primitive, { type: primitive }]) {
      test(`documents the primitive schema ${JSON.stringify(json)}`, async () => {
        const document = await render([{ filename: "primitive.avsc", json }]);
        const root = document.querySelector('section[data-route="#/"]');
        assert.equal(root.querySelector("h1").textContent, primitive);
        assert.equal(
          root.querySelector(".type-details").textContent.trim(),
          `Primitive type: ${primitive}`,
        );
      });
    }
  }

  test("documents the branches of a root union", async () => {
    const document = await render([
      { filename: "union.avsc", json: ["null", "string"] },
    ]);
    const root = document.querySelector('section[data-route="#/"]');
    assert.equal(root.querySelector("h1").textContent, "union");
    assert.match(
      root.querySelector(".type-details").textContent,
      /Union branches/,
    );
    assert.deepEqual(
      [...root.querySelectorAll(".type-details li")].map(
        (li) => li.textContent,
      ),
      ["null", "string"],
    );
  });

  for (const [json, description] of [
    [
      { type: "array", items: ["null", "string"] },
      "Array items: null | string",
    ],
    [{ type: "map", values: "long" }, "Map values: long"],
  ]) {
    test(`documents a root ${json.type} schema`, async () => {
      const document = await render([{ filename: "container.avsc", json }]);
      const root = document.querySelector('section[data-route="#/"]');
      assert.equal(
        root
          .querySelector(".type-details")
          .textContent.trim()
          .replace(/\s+/g, " "),
        description,
      );
    });
  }

  test("links each file to its root schema when multiple unnamed schemas are loaded", async () => {
    const document = await render([
      { filename: "types/string #1.avsc", json: "string" },
      { filename: "union.avsc", json: ["null", "boolean"] },
      { filename: "another-string.avsc", json: "string" },
      { filename: "array.avsc", json: { type: "array", items: "int" } },
      { filename: "map.avsc", json: { type: "map", values: "bytes" } },
    ]);
    const links = [...document.querySelectorAll("td.filename a")];
    assert.equal(links.length, 5);
    assert.equal(
      links[0].getAttribute("href"),
      "#/file/types%2Fstring%20%231.avsc",
    );
    const routes = links.map((link) => link.getAttribute("href"));
    assert.equal(new Set(routes).size, links.length);
    for (const route of routes) {
      const section = document.querySelector(`section[data-route="${route}"]`);
      assert.ok(section, `Missing root section for ${route}`);
      assert.ok(section.querySelector(".type-details").textContent.trim());
    }
  });

  test("keeps root routes separate from named types, including names matching container types", async () => {
    const document = await render([
      {
        filename: "array.avsc",
        json: {
          type: "array",
          items: { type: "record", name: "array", fields: [] },
        },
      },
      { filename: "string.avsc", json: "string" },
    ]);
    const root = document.querySelector(
      'section[data-route="#/file/array.avsc"]',
    );
    assert.ok(root);
    const itemLink = root.querySelector(".type-details a");
    assert.equal(itemLink.textContent, "array");
    const itemSection = document.querySelector(
      `section[data-route="${itemLink.getAttribute("href")}"]`,
    );
    assert.match(itemSection.textContent, /This record has no fields/);
    const routes = [...document.querySelectorAll("section[data-route]")].map(
      (section) => section.getAttribute("data-route"),
    );
    assert.equal(new Set(routes).size, routes.length);
  });
});

describe("Avro union rules", () => {
  for (const json of [
    ["string", "string"],
    ["string", { type: "string" }],
    ["null", { type: "null" }],
    [
      { type: "array", items: "string" },
      { type: "array", items: "int" },
    ],
    [
      { type: "map", values: "string" },
      { type: "map", values: "int" },
    ],
    [{ type: "record", name: "Example", fields: [] }, "Example"],
    [{ type: "record", name: "example.Node", fields: [] }, "example.Node"],
    [{ type: "enum", name: "Example", symbols: ["A"] }, "Example"],
    [{ type: "fixed", name: "Example", size: 1 }, "Example"],
  ]) {
    test(`rejects duplicate union branches ${JSON.stringify(json)}`, () => {
      assert.throws(() => parse(json), /Duplicate union branch/);
    });
  }

  for (const json of [[], ["null", ["string", "int"]]]) {
    test(`rejects an invalid union ${JSON.stringify(json)}`, () => {
      assert.throws(() => parse(json), /Unions must/);
    });
  }

  for (const primitive of primitives) {
    test(`accepts the union [${primitive}]`, () => {
      assert.equal(
        parse([primitive]).schemata[0].root_type.types[0].type,
        primitive,
      );
    });
  }

  test("accepts distinct named branches and recursive references", async () => {
    const json = [
      "null",
      {
        type: "record",
        name: "Node",
        fields: [{ name: "next", type: ["null", "Node"] }],
      },
      { type: "record", name: "OtherNode", fields: [] },
      { type: "enum", name: "first.State", symbols: ["ON"] },
      { type: "enum", name: "State", namespace: "second", symbols: ["OFF"] },
      { type: "fixed", name: "Small", size: 1 },
      { type: "fixed", name: "Large", size: 2 },
      { type: "array", items: ["null", "string"] },
      { type: "map", values: ["null", "long"] },
    ];
    const document = await render([{ filename: "union.avsc", json }]);
    const root = document.querySelector('section[data-route="#/"]');
    assert.equal(root.querySelectorAll(".type-details li").length, json.length);
    for (const link of root.querySelectorAll(".type-details a")) {
      assert.ok(
        document.querySelector(
          `section[data-route="${link.getAttribute("href")}"]`,
        ),
      );
    }
  });

  test("rejects duplicate branches inside record fields too", () => {
    assert.throws(
      () =>
        parse({
          type: "record",
          name: "Example",
          fields: [{ name: "value", type: ["int", "int"] }],
        }),
      /Duplicate union branch/,
    );
  });

  test("does not treat a synthetic union object or an undefined name as an Avro schema", () => {
    assert.throws(
      () => parse({ type: "union", types: ["null", "string"] }),
      /Unsupported Avro schema type/,
    );
    assert.throws(() => parse("Undefined"), /Unknown type name/);
  });
});
