// @ts-check
import express from 'express';
import morgan from 'morgan';
import http from 'http';
import path from 'path';
import { glob } from 'glob';
import fs from 'fs';
import { topLevelHTML } from './src/static_content.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const schema_dir = path.resolve(process.cwd(), process.env.SCHEMA_DIR ?? 'schemata');

/** @type {Array<{filename: string, json: any}>} */
const schemata = [];
const files = await glob('**/*.avsc', { cwd: schema_dir });
files.sort().forEach(function (file) {
    const filepath = path.join(schema_dir, file);
    const json = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    schemata.push({ filename: file, json });
});

const app = express();

app.set('port', process.env.PORT ?? 8080);
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async function (req, res) {
    const html = await topLevelHTML('Server side Avrodoc', [], {
        schemata: schemata,
    });
    res.set('Content-Type', 'text/html').send(html);
});

app.get(/^\/schemata\/(\w[\w.-]*(?:\/\w[\w.-]*)*)$/, function (req, res) {
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
