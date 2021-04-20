/*jshint node:true */

const express = require('express');
const http = require('http');
const path = require('path');
const glob = require('glob');
const fs = require('fs');
const content = require('./src/static_content');

var schema_dir = path.resolve(process.cwd(), process.env.SCHEMA_DIR || 'schemata');
var schemata = [];
glob('**/*.avsc', {cwd: schema_dir}, function (err, files) {
    if (err) throw err;
    files.sort().forEach(function (file) {
        schemata.push({filename: '/schemata/' + file});
    });
});

// Precompile dust templates at app startup, and then serve them out of memory
var dust_templates = content.dustTemplates();

var app = express();

app.set('port', process.env.PORT ?? 8080);
app.use(require('morgan')('combined'));
app.use(require('body-parser').json());
app.use(require('less-middleware')(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    content.topLevelHTML([], {schemata: schemata}, function (err, html) {
        res.set('Content-Type', 'text/html').send(html);
    });
});

app.get('/dust-templates.js', function (req, res) {
    res.set('Content-Type', 'text/javascript').send(dust_templates);
});

app.get(/^\/schemata\/(\w[\w.\-]*(?:\/\w[\w.\-]*)*)$/, function (req, res) {
    fs.readFile(path.join(schema_dir, req.params[0]), 'utf-8', function (err, data) {
        if (err) {
            res.status(404).send('Not found');
        } else {
            res.set('Content-Type', 'application/json').send(data);
        }
    });
});

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
