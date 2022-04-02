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
import debugFn from "debug";
import arg from "arg";

const debug = debugFn("avrodoc:cli");

const argv = arg({
  "--help": Boolean,
  "-h": "--help",

  "--output": String,
  "-o": "--output",

  "--input": String,
  "-i": "--input",

  "--title": String,

  "--style": String,
  "-s": "--style",

  "--ignore-invalid": Boolean,
});

const usage = `USAGE:
    avrodoc [FLAGS] [OPTIONS] [AVRO FILES...]

FLAGS:
        --ignore-invalid     Ignore avsc files that can not be parsed as JSON (instead of quiting)

OPTIONS:
    -i, --input <folder>     Pass in a source folder that will recursively parsed and crawled for avsc files
    -o, --output <file>      The file where the generated doc should be written to
        --title <title>      The title that will be used in the generated HTML page, deafults to "Avrodoc".
    -s, --style <file>       Your own less file, used to override specific style of your generated page

ARGS:
    <AVRO FILES>...          If not --input is given, you can specify individual AVRO files here

EXAMPLES:
    avrodoc --ignore-invalid --input ./schemas --output avrodoc.html --title "My First Avrodoc"

    avrodoc --output avro.html --style my-styles.less avro_schema1.avsc avro_schema2.avsc avro_schema3.avsc
`;

if (
  argv["--help"] ||
  (argv._.length === 0 && Object.entries(argv).length === 1) // no params
) {
  console.log(usage);
  process.exit(0);
}

let inputFiles = [];

if (argv["--input"]) {
  debug("Collecting all avsc files from root folder ", argv["--input"]);
  inputFiles = inputFiles.concat(collectInputFiles(argv["--input"]));
}

if (argv._.length > 0) {
  debug("Using passed arguments as inputfiles...");
  inputFiles = inputFiles.concat(argv._);
}

const outputFile = argv["--output"];
const pageTitle = argv["--title"];
const extraLessFile = argv["--style"];
const ignoreInvalidSchemas = Boolean(argv["--ignore-invalid"]);

//valid input?
if (inputFiles.length === 0) {
  console.error(
    'Missing input schemata, either specify a folder with "--input" or individual AVRO files. Specify "--help" to see usage.'
  );
  process.exit(1);
} else if (outputFile == null) {
  console.error(
    'Missing output file, specify with "--output" where the resulting HTML should go. Specify "--help" to see usage.'
  );
  process.exit(1);
}

createAvroDoc(
  pageTitle,
  extraLessFile ? [extraLessFile] : [],
  inputFiles,
  outputFile,
  ignoreInvalidSchemas
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
  debug("Input dir: ", folder);
  debug("Resolved folder: ", resolvedFolder);
  let dirEntries = fs.readdirSync(resolvedFolder, {
    withFileTypes: true,
  });
  debug("DirEntries: ", dirEntries);
  dirEntries.forEach((entry) => {
    debug("Current entry: ", entry);
    if (entry.isFile()) {
      let file = folder + "/" + entry.name;
      debug("adding file", file);
      if (file.endsWith(".avsc")) {
        files.push(file);
      } else {
        debug(`Ignoring ${file}, not an avro schema file (.avsc)`);
      }
    } else if (entry.isDirectory()) {
      let subfolder = folder + "/" + entry.name;
      debug("Digging into ", subfolder);
      files.push(...collectInputFiles(subfolder));
    }
  });
  return files;
}
