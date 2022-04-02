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
  "--output": String,
  "-o": "--output",

  "--input": String,
  "-i": "--input",

  "--title": String,

  "--style": String,
  "-s": "--style",

  "--ignore-invalid": Boolean,
});

let inputFiles = null;
let outputFile = null;
let ignoreInvalidSchemas = false;

// Determine list of input files file1.avsc file2.avsc
if (argv["--input"]) {
  debug("Collecting all avsc files from root folder ", argv["--input"]);
  inputFiles = collectInputFiles(argv["--input"]);
} else if (argv._.length > 0) {
  debug("Using passed arguments as inputfiles...");
  inputFiles = argv._;
}

// Determine whether an output file is specified
if (argv["--output"]) {
  outputFile = argv["--output"];
}

const extra_less_files = argv["--style"] ? [argv["--style"]] : [];

if (argv["--ignore-invalid"]) {
  ignoreInvalidSchemas = true;
}
const pageTitle = argv["--title"];

//valid input?
if (!inputFiles || inputFiles.length === 0 || outputFile === null) {
  console.error(
    "Usage: avrodoc [-i rootfolder] [my-schema.avsc [another-schema.avsc...]] [-o my-documentation.html] [-s my-style.less] [--ignore-invalid]"
  );
  process.exit(1);
}

createAvroDoc(
  pageTitle,
  extra_less_files,
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
