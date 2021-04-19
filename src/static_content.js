/*jshint node:true */

const uglify = require('uglify-js');
const fs = require('fs');
const path = require('path');
const dust = require('dustjs-linkedin');
require('dustjs-helpers');
const less = require('less');

// LESS stylesheets required in the browser (relative to public/ directory)
const client_css = [
    'stylesheets/style.less'
];

// JS code required in the browser (relative to public/ directory)
const client_js = [
    'vendor/jquery-1.8.2.js',
    'vendor/dust-core-1.1.1.js',
    'vendor/dustjs-helpers-1.1.0.js',
    'vendor/sammy-0.7.1.js',
    'vendor/bootstrap-tooltip.js',
    'vendor/bootstrap-popover.js',
    'vendor/markdown.js',
    'js/avrodoc.js',
    'js/schema.js'
];

// Minimal HTML document that holds it all together
const client_html = dust.compileFn(fs.readFileSync(path.join(__dirname, 'top_level.dust'), 'utf-8'));

const template_dir = path.join(__dirname, '..', 'templates');
const public_dir   = path.join(__dirname, '..', 'public');


// Reads a local Javascript file and returns it in minified form.
function minifiedJS(filename) {
    const options = { output: { beautify: false } }
    const result = uglify.minify(fs.readFileSync(filename, 'utf-8'), options)
    if (result.error) {
        console.error(`Could not minify file ${filename} with UglifyJs:\n` + result.error)
        return ""
    }
    return result.code
}

// Precompiles all templates found in the templates directory, and returns them as a JS string.
function dustTemplates() {
    let compiled = '';
    fs.readdirSync(template_dir).forEach(function (file) {
        if (file.match(/\.dust$/)) {
            const template = fs.readFileSync(path.join(template_dir, file), 'utf-8');
            compiled += dust.compile(template, file.replace(/\.dust$/, ''));
        }
    });
    return compiled;
}

function lessFileAs(type) {
    return function(file) {
        return {name: file, type: type};
    }
}

// Compiles LESS stylesheets and calls callback(error, minified_css).
function stylesheets(extra_less_files, callback) {
    let compiled = '', to_do = 0;
    client_css.map(lessFileAs("internal")).concat(extra_less_files.map(lessFileAs("external"))).forEach(function (file) {
        if (file.name.match(/\.less$/)) {
            to_do++;
            const style = file.type === "internal" ? fs.readFileSync(path.join(public_dir, file.name), 'utf-8') : fs.readFileSync(file.name, 'utf-8');
            const parser = new(less.Parser)({
                paths: file.type === "internal" ? [path.join(public_dir, 'stylesheets')] : "",
                filename: file.name
            });
            parser.parse(style, function (err, tree) {
                if (!err) {
                    compiled += tree.toCSS({compress: true});
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

// Calls callback(error, html) with HTML containing URL references to all JS and CSS required by the
// browser.
function remoteContent(extra_less_files, callback) {
    const html = [];
    client_css.concat(extra_less_files).forEach(function (file) {
        const css_file = file.replace(/\.less$/, '.css');
        html.push('<link rel="stylesheet" type="text/css" href="/' + css_file + '"/>');
    });
    client_js.forEach(function (file) {
        html.push('<script type="text/javascript" src="/' + file + '"></script>');
    });
    html.push('<script type="text/javascript" src="/dust-templates.js"></script>');
    callback(null, html.join('\n'));
}

// Returns HTML containing all JS and CSS required by the browser inline.
function inlineContent(extra_less_files, callback) {
    stylesheets(extra_less_files, function (err, css) {
        if (err) {
            callback(err);
            return;
        }

        const html = [];
        html.push('<style type="text/css">');
        html.push(css);
        html.push('</style>');
        client_js.forEach(function (file) {
            html.push('<script type="text/javascript">');
            html.push(minifiedJS(path.join(public_dir, file)));
            html.push('</script>');
        });
        html.push('<script type="text/javascript">');
        html.push(dustTemplates());
        html.push('</script>');
        callback(null, html.join('\n'));
    });
}

function topLevelHTML(extra_less_files, options, callback) {
    (options.inline ? inlineContent : remoteContent)(extra_less_files, function (err, content) {
        if (err) {
            callback(err);
            return;
        }

        const context = {
            title: 'Avrodoc',
            content: content,
            schemata: '[]',
            ...options,
        }

        if (typeof(context.schemata) !== 'string') {
            context.schemata = JSON.stringify(context.schemata);
        }
        client_html(context, callback);
    });
}

exports.dustTemplates = dustTemplates;
exports.topLevelHTML = topLevelHTML;
