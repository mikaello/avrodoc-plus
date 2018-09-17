/**
 * Filesystemhelpers for collecting and reading and parsing avsc files
 */


const path = require('path');
const fs = require('fs');
const sys = require('util');

/**
 * Reads in the given file and parses as json
 * @param {string} filename
 * @returns {object}
 */
function readJSON(filename) {
    let json, parsed;
    console.debug('Parsing ', filename);
    json = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf-8');
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        sys.error('Not a valid json file: ' + filename);
        process.exit(1);
    }
    return parsed;
}

/**
 * Steps through the given folder and recursively collects all avsc files.
 * @param {string} folder the input folder to iterate and gather all found *.avsc files
 * @returns {Array<string>} the list with all found inputfiles
 */
function collectInputFiles(folder) {
    let files = new Array();
    const resolvedFolder = path.resolve(process.cwd(), folder);
    console.debug('Input dir: ', folder);
    console.debug('Resolved folder: ', resolvedFolder);
    let dirEntries = fs.readdirSync(resolvedFolder, {
        withFileTypes: true
    });
    console.debug('DirEntries: ', dirEntries);
    dirEntries.forEach((entry) => {
        console.debug('Current entry: ', entry);
        if (entry.isFile()) {
            let file = folder + '/' + entry.name;
            console.debug('adding file', file);
            if(file.endsWith('.avsc')){
                files.push(file);
            } else {
                console.debug(`Ignoring ${file}, not an avro schema file (.avsc)`);
            }
        } else if (entry.isDirectory()) {
            let subfolder = folder + '/' + entry.name;
            console.debug('Digging into ', subfolder);
            files.push(...collectInputFiles(subfolder));
        }
    })
    return files;
}

function writeAvroDoc(outputFile, html){
    if (outputFile.indexOf('/') > -1) {
        let outFolder = path.resolve(process.cwd(), outputFile.substring(0, outputFile.lastIndexOf('/')));
        if(!fs.existsSync(outFolder)){
            fs.mkdirSync(outFolder);
        }
    }
    fs.writeFile(outputFile, html, function (err) {
        if (err) {
            throw err;
        } else {
            console.log('Avrodoc saved to ' + outputFile);
        }
    });
}

exports.writeAvroDoc = writeAvroDoc;
exports.readFileAsJSON = readJSON;
exports.collectInputFiles = collectInputFiles;
