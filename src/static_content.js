import fs from "fs";
import { promisify } from "util";

import path from "path";
import dust from "dustjs-linkedin";
import "dustjs-helpers";
import less from "less";
import { transformSync } from "esbuild";

import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

/** LESS stylesheets required in the browser (relative to public/ directory) */
const client_css = ["stylesheets/style.less"];

/** JS code required in the browser (relative to public/ directory) */
const client_js = [
  "vendor/jquery-3.6.0.js",
  "vendor/dust-core-2.7.2.js",
  "vendor/dust-helpers-1.7.4.js",
  "vendor/sammy-0.7.6.js",
  "vendor/bootstrap-tooltip.js",
  "vendor/bootstrap-popover.js",
  "vendor/markdown.js",
  "js/avrodoc.js",
  "js/schema.js",
];

/**
 * Returns a promise that resolves to minimal HTML document that holds it all together
 */
const client_html = promisify(
  dust.compileFn(
    fs.readFileSync(path.join(__dirname, "top_level.dust"), "utf-8")
  )
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

  if (result.error) {
    console.error(
      `Could not minify file ${filename} with ESBuild:\n` + result.error
    );
    return "";
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

function lessFileAs(type) {
  return function (file) {
    return { name: file, type: type };
  };
}

/**
 * Compiles LESS stylesheets and calls callback(error, minified_css).
 *
 * @param {string[]} extra_less_files
 * @param {function(string?,string)} callback arg0=error and arg1=minified_css
 */
function stylesheets(extra_less_files, callback) {
  let compiled = "",
    to_do = 0;
  client_css
    .map(lessFileAs("internal"))
    .concat(extra_less_files.map(lessFileAs("external")))
    .forEach(function (file) {
      if (file.name.match(/\.less$/)) {
        to_do++;
        const style =
          file.type === "internal"
            ? fs.readFileSync(path.join(public_dir, file.name), "utf-8")
            : fs.readFileSync(file.name, "utf-8");
        const parser = new less.Parser({
          paths:
            file.type === "internal"
              ? [path.join(public_dir, "stylesheets")]
              : "",
          filename: file.name,
        });
        parser.parse(style, function (err, tree) {
          if (!err) {
            compiled += tree.toCSS({ compress: true });
          }
          to_do--;
          if (to_do === 0) {
            to_do = -1000; // hack to avoid calling callback twice
            callback(err, compiled);
          }
        });
      }
    });

  if (to_do === 0) {
    callback(null, compiled);
  }
}

/**
 * Calls callback(error, html) with HTML containing URL references to all JS
 * and CSS required by the browser.
 *
 * @param {string[]} extra_less_files
 * @param {function(string?,string)} callback arg0=error and arg1=HTML
 */
function remoteContent(extra_less_files, callback) {
  const html = [];
  client_css.concat(extra_less_files).forEach(function (file) {
    const css_file = file.replace(/\.less$/, ".css");
    html.push(
      '<link rel="stylesheet" type="text/css" href="/' + css_file + '"/>'
    );
  });
  client_js.forEach(function (file) {
    html.push('<script type="text/javascript" src="/' + file + '"></script>');
  });
  html.push(
    '<script type="text/javascript" src="/dust-templates.js"></script>'
  );
  callback(null, html.join("\n"));
}

/**
 * Returns HTML containing all JS and CSS required by the browser inline.
 *
 * @param {string[]} extra_less_files
 * @param {function(string?,string)} callback arg0=error and arg1=HTML
 */
function inlineContent(extra_less_files, callback) {
  stylesheets(extra_less_files, function (err, css) {
    if (err) {
      callback(err);
      return;
    }

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
  });
}

/**
 * Generate HTML and CSS
 *
 * @param {string[]} extra_less_files
 * @param {Object} options - inline function for LESS and context options for DustJs
 * @returns {Promise<string>}
 */
function topLevelHTML(extra_less_files, options) {
  return new Promise((resolve, reject) => {
    (options.inline ? inlineContent : remoteContent)(
      extra_less_files,
      function (err, content) {
        if (err) {
          return reject(err);
        }

        const context = {
          title: "Avrodoc",
          content: content,
          schemata: "[]",
          ...options,
        };

        if (typeof context.schemata !== "string") {
          context.schemata = JSON.stringify(context.schemata);
        }
        return client_html(context)
          .then((html) => resolve(html))
          .catch((err) => reject(err));
      }
    );
  });
}

export { dustTemplates, topLevelHTML };
