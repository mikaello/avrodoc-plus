// @ts-check

const PRIMITIVE_TYPES = new Set([
  "null",
  "boolean",
  "int",
  "long",
  "float",
  "double",
  "bytes",
  "string",
]);

/**
 * Collect the named types a schema defines and references without resolving it.
 *
 * @param {any} json
 * @returns {{ defined: Set<string>, referenced: Set<string> }}
 */
function extractTypeInfo(json) {
  const defined = new Set();
  const referenced = new Set();

  /**
   * @param {string} name
   * @param {string | null | undefined} namespace
   * @returns {string | null}
   */
  function qualifiedName(name, namespace) {
    if (!name) return null;
    return name.includes(".")
      ? name
      : namespace
        ? namespace + "." + name
        : name;
  }

  /**
   * @param {any} schema
   * @param {string | null | undefined} namespace
   * @returns {void}
   */
  function scanDefined(schema, namespace) {
    if (!schema || typeof schema !== "object") return;
    if (Array.isArray(schema)) {
      for (const branch of schema) scanDefined(branch, namespace);
      return;
    }

    const currentNamespace = schema.namespace || namespace;
    if (
      schema.type === "record" ||
      schema.type === "error" ||
      schema.type === "enum" ||
      schema.type === "fixed"
    ) {
      const name = qualifiedName(schema.name, currentNamespace);
      if (name) defined.add(name);
      for (const field of schema.fields || []) {
        scanDefined(field.type, currentNamespace);
      }
    } else if (schema.type === "array") {
      scanDefined(schema.items, currentNamespace);
    } else if (schema.type === "map") {
      scanDefined(schema.values, currentNamespace);
    }

    if (schema.protocol) {
      for (const type of schema.types || []) {
        scanDefined(type, currentNamespace);
      }
    }
  }

  /**
   * @param {any} schema
   * @param {string | null | undefined} namespace
   * @returns {void}
   */
  function scanReferenced(schema, namespace) {
    if (schema == null) return;
    if (typeof schema === "string") {
      if (!PRIMITIVE_TYPES.has(schema)) {
        referenced.add(qualifiedName(schema, namespace) || schema);
      }
      return;
    }
    if (Array.isArray(schema)) {
      for (const branch of schema) scanReferenced(branch, namespace);
      return;
    }
    if (typeof schema !== "object") return;

    const currentNamespace = schema.namespace || namespace;
    if (schema.type === "record" || schema.type === "error") {
      for (const field of schema.fields || []) {
        scanReferenced(field.type, currentNamespace);
      }
    } else if (schema.type === "array") {
      scanReferenced(schema.items, currentNamespace);
    } else if (schema.type === "map") {
      scanReferenced(schema.values, currentNamespace);
    }

    if (schema.protocol) {
      for (const type of schema.types || []) {
        scanReferenced(type, currentNamespace);
      }
      for (const message of Object.values(schema.messages || {})) {
        for (const parameter of message.request || []) {
          scanReferenced(parameter.type, currentNamespace);
        }
        scanReferenced(message.response, currentNamespace);
        for (const error of message.errors || []) {
          scanReferenced(error, currentNamespace);
        }
      }
    }
  }

  scanDefined(json, null);
  scanReferenced(json, null);
  defined.forEach((name) => referenced.delete(name));
  return { defined, referenced };
}

/**
 * Sort parsed schemata so definitions are processed before their references.
 *
 * Entries without parsed JSON keep their relative position unless other parsed
 * entries establish a dependency order around them.
 *
 * @template {{json?: any, filename?: string}} T
 * @param {T[]} schemata
 * @returns {T[]}
 */
function sortSchemataDependencyOrder(schemata) {
  if (schemata.length <= 1) return [...schemata];

  const typeInfos = schemata.map((schema) =>
    schema.json != null
      ? extractTypeInfo(schema.json)
      : { defined: new Set(), referenced: new Set() },
  );
  /** @type {Map<string, Set<number>>} */
  const typeToProviders = new Map();

  typeInfos.forEach(({ defined }, index) => {
    defined.forEach((name) => {
      if (!typeToProviders.has(name)) typeToProviders.set(name, new Set());
      typeToProviders.get(name).add(index);
    });
  });

  /** @type {Set<number>[]} */
  const dependencies = Array.from({ length: schemata.length }, () => new Set());
  typeInfos.forEach(({ referenced }, index) => {
    referenced.forEach((reference) => {
      typeToProviders.get(reference)?.forEach((providerIndex) => {
        if (providerIndex !== index) dependencies[index].add(providerIndex);
      });

      if (!reference.includes(".")) {
        typeToProviders.forEach((providerIndices, qualifiedName) => {
          if (!qualifiedName.endsWith("." + reference)) return;
          providerIndices.forEach((providerIndex) => {
            if (providerIndex !== index) dependencies[index].add(providerIndex);
          });
        });
      }
    });
  });

  const inDegree = new Array(schemata.length).fill(0);
  /** @type {Set<number>[]} */
  const dependants = Array.from({ length: schemata.length }, () => new Set());
  dependencies.forEach((providerIndices, index) => {
    providerIndices.forEach((providerIndex) => {
      dependants[providerIndex].add(index);
      inDegree[index]++;
    });
  });

  const queue = [];
  for (let index = 0; index < schemata.length; index++) {
    if (inDegree[index] === 0) queue.push(index);
  }

  const order = [];
  while (queue.length > 0) {
    const index = queue.shift();
    order.push(index);
    dependants[index].forEach((dependantIndex) => {
      inDegree[dependantIndex]--;
      if (inDegree[dependantIndex] === 0) queue.push(dependantIndex);
    });
  }

  if (order.length !== schemata.length) {
    console.warn(
      "Unable to order all schemata because their cross-file references contain a cycle; preserving input order.",
    );
    return [...schemata];
  }

  return order.map((index) => schemata[index]);
}

export { extractTypeInfo, sortSchemataDependencyOrder };
