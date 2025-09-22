import express from "express";
import morgan from "morgan";
import lessMiddleware from "less-middleware";
import http from "http";
import path from "path";
import { glob } from "glob";
import fs from "fs";
import { dustTemplates, topLevelHTML } from "./src/static_content.js";

import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

const schema_dir = path.resolve(
  process.cwd(),
  process.env.SCHEMA_DIR ?? "schemata"
);
const schemata = [];
const files = glob("**/*.avsc", { cwd: schema_dir })
files.sort().forEach(function (file) {
  schemata.push({ filename: "/schemata/" + file });
});

// Precompile dust templates at app startup, and then serve them out of memory
const dust_templates = dustTemplates();

const app = express();

app.set("port", process.env.PORT ?? 8080);
app.use(morgan("combined"));
app.use(express.json());
app.use(lessMiddleware(__dirname + "/public"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", async function (req, res) {
  const html = await topLevelHTML("Server side Avrodoc", [], {
    schemata: schemata,
  });
  res.set("Content-Type", "text/html").send(html);
});

app.get("/dust-templates.js", function (req, res) {
  res.set("Content-Type", "text/javascript").send(dust_templates);
});

app.get(/^\/schemata\/(\w[\w.-]*(?:\/\w[\w.-]*)*)$/, function (req, res) {
  fs.readFile(
    path.join(schema_dir, req.params[0]),
    "utf-8",
    function (err, data) {
      if (err) {
        res.status(404).send("Not found");
      } else {
        res.set("Content-Type", "application/json").send(data);
      }
    }
  );
});

http.createServer(app).listen(app.get("port"), function () {
  console.log("Express server listening on port " + app.get("port"));
});
