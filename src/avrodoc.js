/**
 * Main avrodoc(-plus) module
 */

import { topLevelHTML } from "./static_content.js";
import fs from "fs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import debug from "debug";

const avrodocDebug = debug("avrodoc:avrodoc");

/**
 *
 * @param {Array<string>} extra_less_files an array with extra less files to be added
 * @param {Array<string>} inputfiles an array with resolved filenames to be read and parsed and eventually added to the avrodoc
 * @param {string} outputfile the html file that should be written
 */
async function createAvroDoc(extra_less_files, inputfiles, outputfile) {
  avrodocDebug(`Creating ${outputfile} from `, inputfiles);
  let schemata = inputfiles.map(function (filename) {
    return {
      json: readJSON(filename),
      filename: filename,
    };
  });
  try {
    const html = await topLevelHTML(extra_less_files, {
      inline: true,
      schemata: schemata,
    });
    return await writeAvroDoc(outputfile, html);
  } catch (err) {
    throw err;
  }
}

// private stuf

async function writeAvroDoc(output, html) {
  if (output.indexOf("/") > -1) {
    let outFolder = path.resolve(
      process.cwd(),
      output.substring(0, output.lastIndexOf("/"))
    );
    if (!fs.existsSync(outFolder)) {
      await mkdir(outFolder);
    }
  }
  await writeFile(output, html);
  console.log("Avrodoc saved to " + output);
}

/**
 * Reads in the given file and parses as json
 * @param {string} filename to be read
 * @returns {object} with parsed AVRO
 */
function readJSON(filename) {
  let json, parsed;
  avrodocDebug("Parsing ", filename);
  json = fs.readFileSync(path.resolve(process.cwd(), filename), "utf-8");
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    console.error("Not a valid json file: " + filename);
    process.exit(1);
  }
  return parsed;
}

export { createAvroDoc };
