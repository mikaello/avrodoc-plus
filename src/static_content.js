// @ts-check
import fs from "fs";
import { promisify } from "util";

import path from "path";
import dust from "dustjs-linkedin";
import "dustjs-helpers";
import { transformSync } from "esbuild";

import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

/** CSS stylesheets required in the browser (relative to public/ directory) */
const client_css = ["stylesheets/bootstrap.min.css", "stylesheets/style.css"];

/** JS code required in the browser (relative to public/ directory) */
const client_js = [
  "vendor/jquery-3.6.0.js",
  "vendor/dust-core-2.7.2.js",
  "vendor/dust-helpers-1.7.4.js",
  "vendor/sammy-0.7.6.js",
  "vendor/bootstrap.bundle.min.js",
  "vendor/markdown.js",
  "js/avrodoc.js",
  "js/schema.js",
];

/**
 * Returns a promise that resolves to minimal HTML document that holds it all together
 */
const client_html = promisify(
  dust.compileFn(
    fs.readFileSync(path.join(__dirname, "top_level.dust"), "utf-8"),
  ),
);

const template_dir = path.join(__dirname, "..", "templates");
const public_dir = path.join(__dirname, "..", "public");

/**
 * Reads a local Javascript file and returns it in minified form.
 *
 * @param {string} filename
 * @returns {string} minified JS content
 */
function minifiedJS(filename) {
  const filecontent = fs.readFileSync(filename, "utf-8");
  const result = transformSync(filecontent, { minify: true });

  if (result.warnings && result.warnings.length > 0) {
    console.error(
      `Warnings when minifying file ${filename} with ESBuild:\n` +
        result.warnings,
    );
  }
  return result.code;
}

/**
 * Precompiles all templates found in the templates directory, and returns them as a JS string.
 *
 * @returns {string} a string of JavaScript source code
 */
function dustTemplates() {
  let compiled = "";
  fs.readdirSync(template_dir).forEach(function (file) {
    if (file.match(/\.dust$/)) {
      const template = fs.readFileSync(path.join(template_dir, file), "utf-8");
      compiled += dust.compile(template, file.replace(/\.dust$/, ""));
    }
  });
  return compiled;
}

/**
 * Reads and concatenates CSS stylesheets (plain CSS, no compilation).
 *
 * @param {string[]} extra_css_files - absolute paths to additional CSS files
 * @returns {string} concatenated CSS content
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
 * Calls callback(error, html) with HTML containing URL references to all JS
 * and CSS required by the browser.
 *
 * @param {string[]} extra_css_files
 * @param {(err: Error | null, html?: string) => void} callback arg0=error and arg1=HTML
 * @returns {void}
 */
function remoteContent(extra_css_files, callback) {
  const html = [];
  client_css.concat(extra_css_files).forEach(function (file) {
    html.push('<link rel="stylesheet" type="text/css" href="/' + file + '"/>');
  });
  client_js.forEach(function (file) {
    html.push('<script type="text/javascript" src="/' + file + '"></script>');
  });
  html.push(
    '<script type="text/javascript" src="/dust-templates.js"></script>',
  );
  callback(null, html.join("\n"));
}

/**
 * Returns HTML containing all JS and CSS required by the browser inline.
 *
 * @param {string[]} extra_css_files
 * @param {(err: Error | null, html?: string) => void} callback arg0=error and arg1=HTML
 * @returns {void}
 */
function inlineContent(extra_css_files, callback) {
  const css = stylesheets(extra_css_files);

  const html = [];
  html.push('<style type="text/css">');
  html.push(css);
  html.push("</style>");
  client_js.forEach(function (file) {
    html.push('<script type="text/javascript">');
    html.push(minifiedJS(path.join(public_dir, file)));
    html.push("</script>");
  });
  html.push('<script type="text/javascript">');
  html.push(dustTemplates());
  html.push("</script>");
  callback(null, html.join("\n"));
}

/**
 * Generate HTML and CSS
 *
 * @param {string} title - main title of the page
 * @param {string[]} extra_css_files - absolute paths to additional plain CSS files to append
 * @param {Object} options - context options
 * @param {boolean} [options.inline] - whether to inline CSS and JS
 * @param {any} [options.schemata] - schema data
 * @param {string[]} [options.annotationFields] - allowlist of annotation keys shown in field tables
 * @returns {Promise<string>}
 */
function topLevelHTML(title, extra_css_files, options) {
  return new Promise((resolve, reject) => {
    (options.inline ? inlineContent : remoteContent)(
      extra_css_files,
      function (err, content) {
        if (err) {
          return reject(err);
        }

        /** @type {Record<string, unknown>} */
        const avrodocOptions = {};
        if (options.annotationFields) {
          avrodocOptions.annotationFields = options.annotationFields;
        }

        const context = {
          page_title: title ?? "Avrodoc",
          content: content,
          schemata: "[]",
          avrodocOptions: JSON.stringify(avrodocOptions),
          ...options,
        };

        if (typeof context.schemata !== "string") {
          context.schemata = JSON.stringify(context.schemata);
        }
        return client_html(context)
          .then((/** @type {string} */ html) => resolve(html))
          .catch((/** @type {Error} */ err) => reject(err));
      },
    );
  });
}

export { dustTemplates, topLevelHTML };
