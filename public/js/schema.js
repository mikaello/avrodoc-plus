/* global AvroDoc:false */

/**
 *  Interprets the contents of one Avro Schema (.avsc) file and transforms it into structures
 *  suitable for rendering.
 *
 * @param {*} avrodoc The main AvroDoc instance.
 * @param {*} shared_types An object of the form
 *   `{'namespace.name': [{type: 'record', fields: [...]}, {type: 'record', fields: [...]}, ...], ...}`
 *   This object is mutated as the schema is parsed; we add the types defined in this schema to the
 *   structure. Different schema files may define the same type differently, hence the array of
 *   types for each qualified name. However, where two different schema files agree on the
 *   definition of a type, we can share the parsed type between the different files.
 * @param {string} schema_json The .avsc file, parsed into a structure of JavaScript objects.
 * @param {string?} filename The name of the file from which the schema was loaded, if available.
 * @returns
 */
AvroDoc.Schema = function (avrodoc, shared_types, schema_json, filename) {
  var _public = { filename: filename };

  // {'namespace.name': {type: 'record', fields: [...]}}
  // containing only types and messages defined in this schema
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

  /**
   * @param {string | [] | object} schema
   * @param {string} namespace
   * @returns {string} qualified type name
   */
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

  /**
   * Check type of object. Get all additional arbitrary attributes on the object
   * for inclusion in the decorated schema object.
   *
   * @param {object} schema
   * @return {object} schema
   */
  function decorateCustomAttributes(schema) {
    if (schema.annotations !== undefined && schema.annotations !== null) {
      return schema;
    }

    var annotations = [],
      ignore_attributes = avrodoc_custom_attributes;
    if (
      schema.type !== null &&
      hasOwnPropertyS(built_in_type_fields, schema.type)
    ) {
      ignore_attributes = ignore_attributes.concat(
        built_in_type_fields[schema.type],
      );
    }

    for (var key in schema) {
      // Only include this annotation if it is not a built-in type or something specific to the avrodoc project
      if (
        hasOwnPropertyS(schema, key) &&
        ignore_attributes.indexOf(key) === -1
      ) {
        var annotation_data = { key: key };
        var annotation_value = schema[key];

        // Check to see if a complex object was provided.
        // In this case, output a pretty-printed JSON blob.
        if (annotation_value !== null && typeof annotation_value === "object") {
          annotation_data.complex_object = JSON.stringify(
            annotation_value,
            undefined,
            3,
          );
        } else if (named_types[annotation_value]) {
          // The value is a known named type. Let's link to it.
          annotation_data.linked_type = named_types[annotation_value];
        } else {
          // Just print the value as a string
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

  /**
   * Takes a node in the schema tree (a JS object) and adds some fields that are
   * useful for template rendering.
   *
   * @param {object} schema
   * @return {object} schema
   */
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

  /**
   * @param {string?} parent
   * @param {string} child
   * @returns {string} parent and child joined
   */
  function joinPath(parent, child) {
    return parent ? [parent, child].join(".") : child;
  }

  /**
   * Given a type name and the current namespace, returns an object representing
   * the type that the name refers to (or throws an exception if the name cannot
   * be resolved). For named types, the same (shared) object is returned
   * whenever the same name is requested.
   * @param {string} name a named type (e.g. `boolean`, `Foo` or `com.example.Foo`)
   * @param {string} namespace e.g. `com.example.service`
   * @param {string} path name of the field
   * @return {object} schema type
   */
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
        // TODO: Should also support arbitrary ordering of Avro schemas (currently
        // this only works if the schema to be referred is parsed first)
        throw `Shared schema ${qualifiedNameStr} does not have type ${JSON.stringify(
          name,
        )}, referred to at ${path}`;
      }
    }

    throw "Unknown type name " + JSON.stringify(name) + " at " + path;
  }

  /**
   * Given an object representing a type (as returned by lookupNamedType, for
   * example), returns the qualified name of that type. We recurse through
   * unnamed complex types (array, map, union) but named types are replaced by
   * their name.
   *
   * @param {string | [] | object} schema
   * @param {string} namespace
   * @returns {string | [] | object}
   */
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

  /**
   * Given a JSON object representing a named type (record, enum, fixed, message
   * or protocol), returns a new object containing only fields that are essential
   * to the definition of the type. This is useful for equality comparison of
   * types.
   *
   * @param {*} schema
   * @returns {{
   *   type: string,
   *   name: string,
   *   fields?: {type: string, name: string}[],
   *   symbols?: any,
   *   size?: any,
   *   request?: any,
   *   response?: any,
   *   errors?: any[],
   *   protocol?: string,
   *   types?: any[],
   *   messages?: any,
   * }}
   */
  function typeEssence(schema) {
    /**
     * @param {object[]} fields
     * @returns {{name: string, type: string}[]}
     */
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

  /** Credit: https://github.com/epoberezkin/fast-deep-equal */
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

    // true if both NaN, false otherwise
    return a !== a && b !== b;
  }

  /**
   * Takes a named type (record, enum, fixed, message or protocol) and adds it to
   * the maps of name to type. If a type with the same qualified name and the
   * same definition is already defined in another schema file, that existing
   * definition is reused. If the qualified name is not yet defined, or the
   * existing definitions differ from this type, a new definition is registered.
   *
   * Note that within one schema file, a qualified name may only map to one
   * particular definition. However, it is acceptable for different schema files to
   * have conflicting definitions for the same qualified name, because different
   * schema files are independent. The sharing of equivalent types is only for
   * conciceness of display.
   *
   * @param {object} schema
   * @param {string?} path
   */
  function defineNamedType(schema, path) {
    const qualified_name = qualifiedName(schema, schema.namespace);
    const new_type = typeEssence(schema);
    let shared_schema = null;

    if (hasOwnPropertyS(shared_types, qualified_name)) {
      shared_schema = shared_types[qualified_name].find((shared_schema) =>
        isEqual(new_type, typeEssence(shared_schema)),
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
      // Type has not yet been defined in this schema file
      named_types[qualified_name] = schema;
      if (!shared_schema) {
        shared_schema = { ...schema }; // shallow clone
        shared_types[qualified_name].push(shared_schema);
      }

      // Only track definitions if we're dealing with multiple input files
      if (avrodoc.input_schemata.length > 1) {
        shared_schema.definitions = shared_schema.definitions || [];
        shared_schema.definitions.push(schema);
      }
    }
    schema.shared = shared_schema;
  }

  // Parse a plain schema (with a record type at the top level, and any other types defined in
  // nested structures on the record's fields).
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

  // Parse an Avro protocol, which has a list of messages (RPC calls) and a list of named types
  // at the top level.
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
      });
      message.response = parseSchema(
        message.response,
        protocol.namespace,
        joinPath(path, "response"),
      );

      // Return an empty array in the case that the method returns 'void'.
      // Javadoc specifications do not show return values for a void method
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
};

/**
 * TODO: should be imported from avrodoc.js
 *
 * Case insensitive string compare
 *
 * @param {string} property to compare by
 * @returns {function(object, object): boolean} objects to have a property compared
 */
const stringCompareByS = (property) => (a, b) => {
  const aProp = a[property] ?? "";
  const bProp = b[property] ?? "";
  return aProp.localeCompare(bProp);
};

/**
 * TODO: should be imported from avrodoc.js
 *
 * Checks if property exists on object
 *
 * @param {object} object
 * @param {string} property
 * @returns {boolean}
 */
const hasOwnPropertyS = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);
