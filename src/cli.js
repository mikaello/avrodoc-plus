/*jshint node:true */

/**
 * CLI usage for avrodoc-plus
 * Usage:
 * avrodoc-plus -i inputfolder -o outputfile
 * avrodoc-plus inputfile1 inputfile2... -o outputfile
 * Example:
 * avrodoc-plus -i schemata -o doc.html
 * avrodoc-plus schemata/user.avsc schemata/account.avsc -o userdoc.html
 */

const avscfs = require('./avscfs');
const content = require('./static_content');
const fs = require('fs');
const sys = require('util');
const argv = require('optimist').alias('o', 'output').alias('i', 'input').argv;
const debug = require('debug')('avrodoc:cli');

let inputFiles = null;
let outputFile = null;

// Determine list of input files file1.avsc file2.avsc
if (argv.input) {
    debug('Collecting all avsc files from root folder ', argv.input);
    inputFiles = avscfs.collectInputFiles(argv.input);
} else if (argv._) {
    debug('Using passed arguments as inputfiles...');
    inputFiles = argv._;
}

// Determine whether an output file is specified
if (argv.output) {
    outputFile = argv.output;
}

//valid input?
if (!inputFiles || inputFiles.length === 0 || outputFile == null) {
    sys.error('Usage: avrodoc [-i rootfolder] [my-schema.avsc [another-schema.avsc...]] [-o=my-documentation.html]');
    process.exit(1);
}


var schemata = inputFiles.map(function (filename) {
    return {
        json: avscfs.readFileAsJSON(filename),
        filename: filename
    };
});

content.topLevelHTML({
    inline: true,
    schemata: schemata
}, function (err, html) {
    if (err) {
        throw err;
    }
    avscfs.writeAvroDoc(outputFile, html);
});
