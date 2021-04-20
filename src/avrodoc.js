/**
 * Main avrodoc(-plus) module
 */

const content = require('./static_content');
const fs = require('fs');
const path = require('path');
const debug = require('debug')('avrodoc:avrodoc');
/**
 * 
 * @param {Array<string>} inputfiles an array with resolved filenames to be read and parsed and eventually added to the avrodoc
 * @param {string} outputfile the html file that should be written
 */
function createAvroDoc(extra_less_files, inputfiles, outputfile){
    debug(`Creating ${outputfile} from `, inputfiles);
    let schemata = inputfiles.map(function (filename) {
        return {
            json: readJSON(filename),
            filename: filename
        };
    });
    content.topLevelHTML(extra_less_files, {
        inline: true,
        schemata: schemata
    }, function (err, html) {
        if (err) {
            throw err;
        }
        writeAvroDoc(outputfile, html);
    });
}


// private stuf

function writeAvroDoc(output, html){
    if (output.indexOf('/') > -1) {
        let outFolder = path.resolve(process.cwd(), output.substring(0, output.lastIndexOf('/')));
        if(!fs.existsSync(outFolder)){
            fs.mkdirSync(outFolder);
        }
    }
    fs.writeFile(output, html, function (err) {
        if (err) {
            throw err;
        } else {
            console.log('Avrodoc saved to ' + output);
        }
    });
}


/**
 * Reads in the given file and parses as json
 * @param {string} filename to be read
 * @returns {object} with parsed AVRO
 */
function readJSON(filename) {
    let json, parsed;
    debug('Parsing ', filename);
    json = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf-8');
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        console.error('Not a valid json file: ' + filename);
        process.exit(1);
    }
    return parsed;
}

exports.createAvroDoc = createAvroDoc;