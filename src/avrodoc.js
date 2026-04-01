// @ts-check
/**
 * Main avrodoc(-plus) module
 */

import { topLevelHTML } from "./static_content.js";
import fs from "fs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * @param {string} title the main title of the generated Avrodoc page
 * @param {Array<string>} extra_less_files an array with extra less files to be added
 * @param {Array<string>} inputfiles an array with resolved filenames to be read and parsed and eventually added to the avrodoc
 * @param {string} outputfile the html file that should be written
 * @param {boolean} [ignoreInvalid] whether to ignore invalid JSON files
 * @returns {Promise<void>}
 */
async function createAvroDoc(
  title,
  extra_less_files,
  inputfiles,
  outputfile,
  ignoreInvalid,
) {
  console.debug(`Creating ${outputfile} from `, inputfiles);
  let schemata = inputfiles
    .map((filename) => {
      const json = readJSON(filename, ignoreInvalid);
      return json != null ? { json, filename } : null;
    })
    .filter((s) => s != null);

  const html = await topLevelHTML(title, extra_less_files, {
    inline: true,
    schemata,
  });
  return await writeAvroDoc(outputfile, html);
}

// private stuf

/**
 * @param {string} output
 * @param {string} html
 * @returns {Promise<void>}
 */
async function writeAvroDoc(output, html) {
  if (output.indexOf("/") > -1) {
    let outFolder = path.resolve(
      process.cwd(),
      output.substring(0, output.lastIndexOf("/")),
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
 * @param {boolean} [ignoreInvalid] should we ignore invalid JSON files
 * @returns {any | undefined} parsed AVRO or undefined if invalid and ignoring
 */
function readJSON(filename, ignoreInvalid) {
  let json, parsed;
  console.debug("Parsing ", filename);
  json = fs.readFileSync(path.resolve(process.cwd(), filename), "utf-8");
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error("Not a valid JSON file: " + filename);
    if (ignoreInvalid) {
      return;
    }
    process.exit(1);
  }
  return parsed;
}

export { createAvroDoc };
