// @ts-check
/**
 * CLI usage for avrodoc-plus
 * Usage:
 * avrodoc-plus -i inputfolder -o outputfile
 * avrodoc-plus inputfile1 inputfile2... -o outputfile
 * Example:
 * avrodoc-plus -i schemata -o doc.html
 * avrodoc-plus schemata/user.avsc schemata/account.avsc -o userdoc.html
 */

import { createAvroDoc } from "./avrodoc.js";
import fs from "fs";
import path from "path";
import { parseArgs } from "node:util";

const usage = `USAGE:
    avrodoc-plus [FLAGS] [OPTIONS] [AVRO FILES...]

FLAGS:
        --ignore-invalid     Ignore avsc files that can not be parsed as JSON (instead of quiting)

OPTIONS:
    -i, --input <folder>          Pass in a source folder that will recursively parsed and crawled for avsc files
    -o, --output <file>           The file where the generated doc should be written to
        --title <title>           The title that will be used in the generated HTML page, defaults to "Avrodoc".
    -s, --style <file>            Your own less file, used to override specific style of your generated page
        --annotation-fields <f>   Comma-separated list of annotation keys to show in field tables.
                                  Defaults to "logicalType,aliases,order".

ARGS:
    <AVRO FILES>...          If not --input is given, you can specify individual AVRO files here

EXAMPLES:
    avrodoc-plus --ignore-invalid --input ./schemas --output avrodoc.html --title "My First Avrodoc"

    avrodoc-plus --output avro.html --style my-styles.less avro_schema1.avsc avro_schema2.avsc avro_schema3.avsc
`;

const { values: argv, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h", default: false },
    output: { type: "string", short: "o" },
    input: { type: "string", short: "i" },
    title: { type: "string" },
    style: { type: "string", short: "s" },
    "ignore-invalid": { type: "boolean", default: false },
    "annotation-fields": { type: "string" },
  },
});

if (argv.help || (positionals.length === 0 && !argv.input && !argv.output)) {
  console.log(usage);
  process.exit(0);
}

/** @type {string[]} */
let inputFiles = [];

if (argv.input) {
  console.debug("Collecting all avsc files from root folder ", argv.input);
  inputFiles = inputFiles.concat(collectInputFiles(argv.input));
}

if (positionals.length > 0) {
  console.debug("Using passed arguments as inputfiles...");
  inputFiles = inputFiles.concat(positionals);
}

const outputFile = argv.output;
const pageTitle = argv.title;
const extraLessFile = argv.style;
const ignoreInvalidSchemas = Boolean(argv["ignore-invalid"]);
const annotationFields = argv["annotation-fields"]
  ? argv["annotation-fields"].split(",").map((f) => f.trim())
  : undefined;

if (inputFiles.length === 0) {
  console.error(
    'Missing input schemata, either specify a folder with "--input" or individual AVRO files. Specify "--help" to see usage.',
  );
  process.exit(1);
} else if (outputFile == null) {
  console.error(
    'Missing output file, specify with "--output" where the resulting HTML should go. Specify "--help" to see usage.',
  );
  process.exit(1);
}

createAvroDoc(
  pageTitle ?? "Avrodoc",
  extraLessFile ? [extraLessFile] : [],
  inputFiles,
  outputFile,
  ignoreInvalidSchemas,
  annotationFields,
);

//private stuff

/**
 * Steps through the given folder and recursively collects all avsc files.
 * @param {string} folder the input folder to iterate and gather all found *.avsc files
 * @returns {Array<string>} the list with all found inputfiles
 */
function collectInputFiles(folder) {
  let files = new Array();
  const resolvedFolder = path.resolve(process.cwd(), folder);
  console.debug("Input dir: ", folder);
  console.debug("Resolved folder: ", resolvedFolder);
  let dirEntries = fs.readdirSync(resolvedFolder, {
    withFileTypes: true,
  });
  console.debug("DirEntries: ", dirEntries);
  dirEntries.forEach((entry) => {
    console.debug("Current entry: ", entry);
    if (entry.isFile()) {
      let file = folder + "/" + entry.name;
      console.debug("adding file", file);
      if (file.endsWith(".avsc")) {
        files.push(file);
      } else {
        console.debug(`Ignoring ${file}, not an avro schema file (.avsc)`);
      }
    } else if (entry.isDirectory()) {
      let subfolder = folder + "/" + entry.name;
      console.debug("Digging into ", subfolder);
      files.push(...collectInputFiles(subfolder));
    }
  });
  return files;
}
