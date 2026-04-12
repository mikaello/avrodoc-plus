// @ts-nocheck -- dynamic Avro schema parsing; was not type-checked in its original location (public/js/schema.js)

/**
 * Server-side schema parser ported from public/js/schema.js
 *
 * @param {{ annotationFields: string[], inputSchemataCount: number }} options
 * @param {Record<string, any[]>} shared_types  mutated in-place
 * @param {any} schema_json
 * @param {string} filename
 * @returns {{ filename: string, root_type: any, named_types: Record<string, any>, sorted_types: any[] }}
 */
function parseAvroSchema(options, shared_types, schema_json, filename) {
  var _public = { filename: filename };

  // {'namespace.name': {type: 'record', fields: [...]}}
  var named_types = {};

  var primitive_types = [
    "null",
    "boolean",
    "int",
    "long",
    "float",
    "double",
    "bytes",
    "string",
  ];

  var built_in_type_fields = {
    record: ["type", "name", "namespace", "doc", "aliases", "fields"],
    error: ["type", "name", "namespace", "doc", "aliases", "fields"],
    message: [
      "type",
      "name",
      "namespace",
      "doc",
      "request",
      "response",
      "errors",
    ],
    enum: ["type", "name", "namespace", "doc", "aliases", "symbols"],
    array: ["type", "items"],
    map: ["type", "values"],
    fixed: ["type", "name", "namespace", "aliases", "size"],
    field: ["type", "name", "doc", "aliases", "type", "default", "order"],
    protocol: [
      "type",
      "name",
      "namespace",
      "doc",
      "protocol",
      "messages",
      "types",
    ],
    union: ["type", "types"],
  };

  var avrodoc_custom_attributes = [
    "type",
    "shared",
    "definitions",
    "protocol_name",
    "sorted_messages",
    "sorted_types",
    "filename",
    "qualified_name",
    "link",
    "shared_link",
    "is_enum",
    "is_message",
    "is_record",
    "is_protocol",
    "is_error",
    "is_array",
    "is_map",
    "is_fixed",
    "is_field",
    "is_string",
    "is_null",
    "is_int",
    "is_long",
    "is_double",
    "is_union",
    "is_primitive",
    "attributes",
  ];

  const isString = (x) =>
    Object.prototype.toString.call(x) === "[object String]";
  const isObject = (x) =>
    Object.prototype.toString.call(x) === "[object Object]";
  const isArray = (x) => Object.prototype.toString.call(x) === "[object Array]";

  function qualifiedName(schema, namespace) {
    var type_name;
    if (isString(schema)) {
      type_name = schema;
    } else if (isObject(schema) && !isArray(schema)) {
      namespace = schema.namespace || namespace;
      type_name = schema.name || schema.protocol || schema.type;
    }
    if (!type_name) {
      throw (
        "unable to determine type name from schema " +
        JSON.stringify(schema) +
        " in namespace " +
        namespace
      );
    } else if (type_name.indexOf(".") >= 0) {
      return type_name;
    } else if (primitive_types.includes(type_name)) {
      return type_name;
    } else if (namespace) {
      return namespace + "." + type_name;
    } else {
      return type_name;
    }
  }

  function decorateCustomAttributes(schema) {
    if (schema.annotations !== undefined && schema.annotations !== null) {
      return schema;
    }
    var annotations = [];
    var ignore_attributes = avrodoc_custom_attributes;
    if (
      schema.type !== null &&
      hasOwnPropertyS(built_in_type_fields, schema.type)
    ) {
      ignore_attributes = ignore_attributes.concat(
        built_in_type_fields[schema.type],
      );
    }
    for (var key in schema) {
      if (
        hasOwnPropertyS(schema, key) &&
        ignore_attributes.indexOf(key) === -1
      ) {
        var annotation_data = { key: key };
        var annotation_value = schema[key];
        if (annotation_value !== null && typeof annotation_value === "object") {
          annotation_data.complex_object = JSON.stringify(
            annotation_value,
            undefined,
            3,
          );
        } else if (named_types[annotation_value]) {
          annotation_data.linked_type = named_types[annotation_value];
        } else {
          annotation_data.value = annotation_value;
        }
        annotations.push(annotation_data);
      }
    }
    if (annotations.length > 0) {
      schema.annotations = annotations;
    }
    return schema;
  }

  function buildTableAnnotations(field, allowedKeys) {
    var result = [];
    allowedKeys.forEach(function (key) {
      var source =
        hasOwnPropertyS(field, key) && field[key] !== undefined
          ? field
          : isObject(field.type) &&
              hasOwnPropertyS(field.type, key) &&
              field.type[key] !== undefined
            ? field.type
            : null;
      if (!source) return;
      var val = source[key];
      var data = { key: key };
      if (val !== null && typeof val === "object") {
        data.complex_object = JSON.stringify(val, undefined, 3);
      } else {
        data.value = val;
      }
      result.push(data);
    });
    if (result.length > 0) {
      return result;
    }
    return undefined;
  }

  function decorate(schema) {
    schema.filename = filename;
    schema["is_" + schema.type] = true;
    if (schema.is_error) {
      schema.is_record = true;
    }
    schema.qualified_name = qualifiedName(schema);
    schema = decorateCustomAttributes(schema);
    if (primitive_types.includes(schema.type)) {
      schema.is_primitive = true;
    } else {
      schema.link = [
        "#",
        "schema",
        encodeURIComponent(filename || "default"),
        encodeURIComponent(qualifiedName(schema)),
      ].join("/");
      schema.shared_link = [
        "#",
        "schema",
        encodeURIComponent(qualifiedName(schema)),
      ].join("/");
    }
    if (schema.shared) decorate(schema.shared);
    return schema;
  }

  function joinPath(parent, child) {
    return parent ? [parent, child].join(".") : child;
  }

  function lookupNamedType(name, namespace, path) {
    if (primitive_types.includes(name)) {
      return decorate({ type: name });
    }
    const qualifiedNameStr = qualifiedName(name, namespace);
    const type = named_types[qualifiedNameStr];
    if (type) {
      return type;
    } else if (hasOwnPropertyS(shared_types, qualifiedNameStr)) {
      const sharedType = shared_types[qualifiedNameStr].find(
        (sharedSchema) => sharedSchema.qualified_name === qualifiedNameStr,
      );
      if (sharedType) {
        return sharedType;
      } else {
        throw `Shared schema ${qualifiedNameStr} does not have type ${JSON.stringify(name)}, referred to at ${path}`;
      }
    }
    throw "Unknown type name " + JSON.stringify(name) + " at " + path;
  }

  function extractTypeName(schema, namespace) {
    if (isString(schema)) {
      return schema;
    } else if (isArray(schema)) {
      return schema.map((type) => extractTypeName(type, namespace));
    } else if (isObject(schema)) {
      if (
        schema.type === "record" ||
        schema.type === "enum" ||
        schema.type === "fixed" ||
        schema.type === "error"
      ) {
        return qualifiedName(schema, namespace);
      } else if (schema.type === "array") {
        return {
          type: "array",
          items: extractTypeName(schema.items, namespace),
        };
      } else if (schema.type === "map") {
        return {
          type: "map",
          values: extractTypeName(schema.values, namespace),
        };
      } else if (schema.type === "union") {
        return schema.types.map((type) => extractTypeName(type, namespace));
      } else if (primitive_types.includes(schema.type)) {
        return schema.type;
      } else {
        throw (
          "extractTypeName: unsupported Avro schema type: " +
          JSON.stringify(schema.type)
        );
      }
    } else {
      throw "extractTypeName: unexpected schema: " + JSON.stringify(schema);
    }
  }

  function typeEssence(schema) {
    function fieldsWithTypeNames(fields) {
      return fields.map((field) => ({
        name: field.name,
        type: extractTypeName(field.type, schema.namespace),
      }));
    }
    var essence = {
      type: schema.type,
      name: qualifiedName(schema, schema.namespace),
    };
    if (schema.type === "record" || schema.type === "error") {
      essence.fields = fieldsWithTypeNames(schema.fields);
    } else if (schema.type === "enum") {
      essence.symbols = schema.symbols;
    } else if (schema.type === "fixed") {
      essence.size = schema.size;
    } else if (schema.type === "message") {
      essence.request = fieldsWithTypeNames(schema.request || []);
      essence.response = extractTypeName(schema.response, schema.namespace);
      essence.errors = (schema.errors || []).map((error) =>
        extractTypeName(error, schema.namespace),
      );
    } else if (schema.type === "protocol") {
      essence = { protocol: qualifiedName(schema, schema.namespace) };
      essence.types = (schema.types ?? []).map(typeEssence);
      essence.messages = Object.fromEntries(
        Object.entries(schema.messages ?? {}).map(([messageName, message]) => [
          messageName,
          typeEssence(message),
        ]),
      );
    } else {
      throw "typeEssence() only supports named types, not " + schema.type;
    }
    return essence;
  }

  function isEqual(a, b) {
    if (a === b) return true;
    if (a && b && typeof a == "object" && typeof b == "object") {
      if (a.constructor !== b.constructor) return false;
      var length, i, keys;
      if (Array.isArray(a)) {
        length = a.length;
        if (length != b.length) return false;
        for (i = length; i-- !== 0; ) if (!isEqual(a[i], b[i])) return false;
        return true;
      }
      if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (i of a.entries()) if (!b.has(i[0])) return false;
        for (i of a.entries()) if (!isEqual(i[1], b.get(i[0]))) return false;
        return true;
      }
      if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (i of a.entries()) if (!b.has(i[0])) return false;
        return true;
      }
      if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
        length = a.length;
        if (length != b.length) return false;
        for (i = length; i-- !== 0; ) if (a[i] !== b[i]) return false;
        return true;
      }
      if (a.constructor === RegExp)
        return a.source === b.source && a.flags === b.flags;
      if (a.valueOf !== Object.prototype.valueOf)
        return a.valueOf() === b.valueOf();
      if (a.toString !== Object.prototype.toString)
        return a.toString() === b.toString();
      keys = Object.keys(a);
      length = keys.length;
      if (length !== Object.keys(b).length) return false;
      for (i = length; i-- !== 0; )
        if (!hasOwnPropertyS(b, keys[i])) return false;
      for (i = length; i-- !== 0; ) {
        var key = keys[i];
        if (!isEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return a !== a && b !== b;
  }

  function defineNamedType(schema, path) {
    const qualified_name = qualifiedName(schema, schema.namespace);
    const new_type = typeEssence(schema);
    let shared_schema = null;

    if (hasOwnPropertyS(shared_types, qualified_name)) {
      shared_schema = shared_types[qualified_name].find((s) =>
        isEqual(new_type, typeEssence(s)),
      );
    } else {
      shared_types[qualified_name] = [];
    }

    if (hasOwnPropertyS(named_types, qualified_name)) {
      var existing_type = typeEssence(named_types[qualified_name]);
      if (!isEqual(new_type, existing_type)) {
        throw (
          "Conflicting definition for type " +
          qualified_name +
          " at " +
          path +
          ": " +
          JSON.stringify(existing_type) +
          " != " +
          JSON.stringify(new_type)
        );
      }
    } else {
      named_types[qualified_name] = schema;
      if (!shared_schema) {
        shared_schema = { ...schema };
        shared_types[qualified_name].push(shared_schema);
      }
      if (options.inputSchemataCount > 1) {
        shared_schema.definitions = shared_schema.definitions || [];
        shared_schema.definitions.push(schema);
      }
    }
    schema.shared = shared_schema;
  }

  function parseSchema(schema, namespace, path) {
    if (schema == null) {
      throw "Missing schema type at " + path;
    } else if (isString(schema)) {
      return lookupNamedType(schema, namespace, path);
    } else if (isObject(schema) && !isArray(schema)) {
      if (schema.type === "record" || schema.type === "error") {
        if (!isArray(schema.fields)) {
          throw (
            "Unexpected value " +
            JSON.stringify(schema.fields) +
            " for " +
            schema.type +
            " fields at " +
            path
          );
        }
        schema.namespace = schema.namespace || namespace;
        defineNamedType(schema, path);
        schema.fields.forEach((field) => {
          field.type = parseSchema(
            field.type,
            schema.namespace,
            joinPath(path, field.name),
          );
          field.default_str = JSON.stringify(field["default"], null, " ");
          decorateCustomAttributes(field);
          field.table_annotations = buildTableAnnotations(
            field,
            options.annotationFields,
          );
        });
        return decorate(schema);
      } else if (schema.type === "enum") {
        if (!isArray(schema.symbols)) {
          throw (
            "Unexpected value " +
            JSON.stringify(schema.symbols) +
            " for enum symbols at " +
            path
          );
        }
        schema.namespace = schema.namespace || namespace;
        defineNamedType(schema, path);
        return decorate(schema);
      } else if (schema.type === "fixed") {
        if (typeof schema.size !== "number" || schema.size < 1) {
          throw (
            "Unexpected size " +
            JSON.stringify(schema.size) +
            " for fixed type at " +
            path
          );
        }
        schema.namespace = schema.namespace || namespace;
        defineNamedType(schema, path);
        return decorate(schema);
      } else if (schema.type === "array") {
        schema.items = parseSchema(
          schema.items,
          namespace,
          joinPath(path, "items"),
        );
        return decorate(schema);
      } else if (schema.type === "map") {
        schema.values = parseSchema(
          schema.values,
          namespace,
          joinPath(path, "values"),
        );
        return decorate(schema);
      } else if (primitive_types.includes(schema.type)) {
        return decorate(schema);
      } else {
        throw 'Unsupported Avro schema type "' + schema.type + '" at ' + path;
      }
    } else if (isArray(schema)) {
      if (schema.length === 0) {
        throw "Unions must have at least one branch type at " + path;
      }
      return decorate({
        type: "union",
        types: schema.map((branch_type) => {
          if (isArray(branch_type)) {
            throw "Unions must not be nested at " + path;
          }
          const type_name = isObject(branch_type)
            ? branch_type.name || branch_type.type
            : branch_type;
          return parseSchema(branch_type, namespace, joinPath(path, type_name));
        }),
      });
    } else {
      throw (
        "Unexpected schema contents " + JSON.stringify(schema) + " at " + path
      );
    }
  }

  function parseProtocol(protocol) {
    protocol.type = "protocol";
    protocol.name = protocol.protocol;
    protocol.types = (protocol.types ?? []).map((type) =>
      parseSchema(type, protocol.namespace, "types"),
    );
    for (const [messageName, message] of Object.entries(
      protocol.messages ?? {},
    )) {
      var path = "messages." + messageName;
      message.type = "message";
      message.name = messageName;
      message.namespace = protocol.namespace;
      message.protocol_name = qualifiedName(protocol.name, protocol.namespace);
      (message.request ?? []).forEach(function (param) {
        param.type = parseSchema(
          param.type,
          protocol.namespace,
          joinPath(path, "request." + param.name),
        );
        param.default_str = JSON.stringify(param["default"], null, " ");
        decorateCustomAttributes(param);
        param.table_annotations = buildTableAnnotations(
          param,
          options.annotationFields,
        );
      });
      message.response = parseSchema(
        message.response,
        protocol.namespace,
        joinPath(path, "response"),
      );
      if (message.response && message.response.type === "null") {
        message.response = [];
      }
      message.errors = (message.errors ?? []).map((error) =>
        parseSchema(error, protocol.namespace, joinPath(path, "errors")),
      );
      defineNamedType(message, path);
      decorate(message);
    }
    protocol.sorted_messages = Object.values(protocol.messages ?? {}).sort(
      stringCompareByS("name"),
    );
    defineNamedType(protocol);
    return decorate(protocol);
  }

  if (typeof schema_json === "string") {
    schema_json = JSON.parse(schema_json);
  }

  if (isObject(schema_json) && schema_json.protocol) {
    _public.root_type = parseProtocol(schema_json);
  } else {
    _public.root_type = parseSchema(schema_json);
  }

  _public.root_type.is_root_type = true;
  _public.named_types = named_types;
  _public.sorted_types = Object.values(named_types).sort(
    stringCompareByS("name"),
  );

  return _public;
}

/**
 * Build the full context object for rendering Avrodoc templates.
 *
 * @param {Array<{filename: string, json: any}>} input_schemata
 * @param {{ annotationFields?: string[] }} [options]
 * @returns {{ schema_by_name: Record<string, any>, shared_types: Record<string, any[]>, schemata: any[], by_qualified_name: Record<string, any>, namespaces: any[], protocols: any[] }}
 */
export function buildAvroDocContext(input_schemata, options = {}) {
  const annotationFields = options.annotationFields || [
    "logicalType",
    "aliases",
    "order",
  ];
  const schema_by_name = {};
  const shared_types = {};

  for (const { filename, json } of input_schemata) {
    let fname = filename || "default";
    if (schema_by_name[fname]) {
      let i = 1;
      while (schema_by_name[fname + i]) i++;
      fname = fname + i;
    }
    schema_by_name[fname] = parseAvroSchema(
      { annotationFields, inputSchemataCount: input_schemata.length },
      shared_types,
      json,
      fname,
    );
  }

  const by_qualified_name = {};
  for (const [qualified_name, versions] of Object.entries(shared_types)) {
    by_qualified_name[qualified_name] = { ...versions[0] };
    by_qualified_name[qualified_name].versions = versions;
  }

  const namespacesMap = {};
  for (const shared_type of Object.values(by_qualified_name)) {
    if (shared_type.is_record || shared_type.is_enum || shared_type.is_fixed) {
      const namespace = shared_type.namespace || "";
      if (!Object.prototype.hasOwnProperty.call(namespacesMap, namespace)) {
        namespacesMap[namespace] = { namespace, types: [] };
      }
      namespacesMap[namespace].types.push(shared_type);
    }
  }
  const namespaces = Object.values(namespacesMap)
    .sort((a, b) => (a.namespace ?? "").localeCompare(b.namespace ?? ""))
    .map((ns) => ({
      namespace: ns.namespace || "No namespace",
      types: [...ns.types].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    }));

  const protocols = Object.values(by_qualified_name)
    .filter((t) => t.is_protocol)
    .sort((a, b) =>
      (a.qualified_name ?? "").localeCompare(b.qualified_name ?? ""),
    );

  const schemata = Object.values(schema_by_name);

  return {
    schema_by_name,
    shared_types,
    schemata,
    by_qualified_name,
    namespaces,
    protocols,
  };
}

const stringCompareByS = (property) => (a, b) => {
  const aProp = a[property] ?? "";
  const bProp = b[property] ?? "";
  return aProp.localeCompare(bProp);
};

const hasOwnPropertyS = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);
