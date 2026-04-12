// @ts-check
import fs from "fs";
import path from "path";
import nunjucks from "nunjucks";
import { marked } from "marked";
import { transformSync } from "esbuild";
import { buildAvroDocContext } from "./schema_parser.js";

import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

/** CSS stylesheets required in the browser (relative to public/ directory) */
const client_css = ["stylesheets/bootstrap.min.css", "stylesheets/style.css"];

/** JS code required in the browser (relative to public/ directory) */
const client_js = ["vendor/bootstrap.bundle.min.js", "js/avrodoc.js"];

const template_dir = path.join(__dirname, "..", "templates");
const public_dir = path.join(__dirname, "..", "public");
const src_dir = __dirname;

const nunjucksEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader([template_dir, src_dir]),
  { autoescape: true },
);

nunjucksEnv.addFilter("markdown", (value) =>
  value ? marked(String(value)) : "",
);
nunjucksEnv.addFilter("inlineType", renderInlineType);

/**
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {any} type
 * @returns {string}
 */
function renderInlineType(type) {
  if (!type) return "";
  if (type.is_protocol)
    return (
      '<a href="' + escHtml(type.link) + '">' + escHtml(type.protocol) + "</a>"
    );
  if (type.is_record || type.is_enum || type.is_fixed)
    return (
      '<a href="' + escHtml(type.link) + '">' + escHtml(type.name) + "</a>"
    );
  if (type.is_array) return "array&lt;" + renderInlineType(type.items) + "&gt;";
  if (type.is_map) return "map&lt;" + renderInlineType(type.values) + "&gt;";
  if (type.is_union)
    return type.types.map(renderInlineType).join("&nbsp;|&nbsp;");
  if (type.is_primitive) return escHtml(type.type);
  return escHtml(type.type || "");
}

/**
 * Reads a local Javascript file and returns it in minified form.
 * @param {string} filename
 * @returns {string}
 */
function minifiedJS(filename) {
  const filecontent = fs.readFileSync(filename, "utf-8");
  const result = transformSync(filecontent, { minify: true });
  if (result.warnings && result.warnings.length > 0) {
    console.error(
      "Warnings when minifying " + filename + ":\n" + result.warnings,
    );
  }
  return result.code;
}

/**
 * @param {string[]} extra_css_files
 * @returns {string}
 */
function stylesheets(extra_css_files) {
  let css = "";
  for (const file of client_css) {
    css += fs.readFileSync(path.join(public_dir, file), "utf-8");
  }
  for (const file of extra_css_files) {
    css += fs.readFileSync(file, "utf-8");
  }
  return css;
}

/**
 * @param {string[]} extra_css_files
 * @returns {string}
 */
function remoteContent(extra_css_files) {
  const html = [];
  for (const file of client_css.concat(extra_css_files)) {
    html.push('<link rel="stylesheet" type="text/css" href="/' + file + '"/>');
  }
  for (const file of client_js) {
    html.push('<script type="text/javascript" src="/' + file + '"></script>');
  }
  return html.join("\n");
}

/**
 * @param {string[]} extra_css_files
 * @returns {string}
 */
function inlineContent(extra_css_files) {
  const css = stylesheets(extra_css_files);
  const html = [];
  html.push('<style type="text/css">');
  html.push(css);
  html.push("</style>");
  for (const file of client_js) {
    html.push('<script type="text/javascript">');
    html.push(minifiedJS(path.join(public_dir, file)));
    html.push("</script>");
  }
  return html.join("\n");
}

/**
 * Render the list pane HTML.
 * @param {{ page_title: string, namespaces: any[], protocols: any[] }} ctx
 * @returns {string}
 */
function renderListPane(ctx) {
  return nunjucksEnv.render("schema_list.njk", ctx);
}

/**
 * Escape a string for safe embedding inside an HTML attribute.
 * @param {string} str
 * @returns {string}
 */
function escAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render all section elements for the content pane.
 * @param {{ schemata: any[], schema_by_name: Record<string, any>, by_qualified_name: Record<string, any>, page_title: string }} ctx
 * @returns {string}
 */
function renderSections(ctx) {
  const sections = [];

  // Default section (#/)
  if (ctx.schemata.length === 1) {
    const rootType = ctx.schemata[0].root_type;
    const html = nunjucksEnv.render("named_type.njk", rootType);
    sections.push('<section data-route="#/" hidden>\n' + html + "\n</section>");
  } else {
    const html = nunjucksEnv.render("schema_file_list.njk", ctx);
    sections.push('<section data-route="#/" hidden>\n' + html + "\n</section>");
  }

  // Per-file type sections: #/schema/<filename>/<qualified_name>
  for (const [filename, schema] of Object.entries(ctx.schema_by_name)) {
    for (const [qualified_name, type] of Object.entries(schema.named_types)) {
      const route =
        "#/schema/" +
        encodeURIComponent(filename) +
        "/" +
        encodeURIComponent(qualified_name);
      const html = nunjucksEnv.render("named_type.njk", type);
      sections.push(
        '<section data-route="' +
          escAttr(route) +
          '" hidden>\n' +
          html +
          "\n</section>",
      );
    }
  }

  // Shared type sections: #/schema/<qualified_name>
  for (const [qualified_name, type] of Object.entries(ctx.by_qualified_name)) {
    const route = "#/schema/" + encodeURIComponent(qualified_name);
    const html = nunjucksEnv.render("named_type.njk", type);
    sections.push(
      '<section data-route="' +
        escAttr(route) +
        '" hidden>\n' +
        html +
        "\n</section>",
    );
  }

  return sections.join("\n");
}

/**
 * Build the popover data JSON string (pre-rendered title+content for each named type).
 * @param {{ schema_by_name: Record<string, any> }} ctx
 * @returns {string}
 */
function buildPopoverData(ctx) {
  /** @type {Record<string, Record<string, {title: string, content: string}>>} */
  const popoverData = {};

  for (const [filename, schema] of Object.entries(ctx.schema_by_name)) {
    popoverData[filename] = {};
    for (const [qualified_name, type] of Object.entries(schema.named_types)) {
      const title = nunjucksEnv.render("popover_title.njk", type).trim();
      const content = nunjucksEnv.render("named_type_details.njk", type);
      popoverData[filename][qualified_name] = { title, content };
    }
  }

  // Escape </script> sequences to prevent breaking inline JSON script tags
  return JSON.stringify(popoverData).replace(/<\//g, "<\\/");
}

/**
 * Generate HTML and CSS
 *
 * @param {string} title - main title of the page
 * @param {string[]} extra_css_files - absolute paths to additional plain CSS files to append
 * @param {Object} options - context options
 * @param {boolean} [options.inline] - whether to inline CSS and JS
 * @param {Array<{filename: string, json: any}>} [options.schemata] - schema data
 * @param {string[]} [options.annotationFields] - allowlist of annotation keys shown in field tables
 * @returns {Promise<string>}
 */
async function topLevelHTML(title, extra_css_files, options) {
  const content = options.inline
    ? inlineContent(extra_css_files)
    : remoteContent(extra_css_files);

  const page_title = title ?? "Avrodoc";
  const input_schemata = options.schemata || [];

  const avroContext = buildAvroDocContext(input_schemata, {
    annotationFields: options.annotationFields,
  });

  const ctx = {
    ...avroContext,
    page_title,
  };

  const list_pane_html = renderListPane(ctx);
  const sections_html = renderSections(ctx);
  const popover_data = buildPopoverData(ctx);

  return nunjucksEnv.render("top_level.njk", {
    page_title,
    content,
    list_pane_html,
    sections_html,
    popover_data,
  });
}

export { topLevelHTML };
