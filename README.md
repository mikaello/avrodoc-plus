# avrodoc-plus

[![npm](https://img.shields.io/npm/v/@mikaello/avrodoc-plus.svg?style=flat-square)](https://www.npmjs.com/package/@mikaello/avrodoc-plus)
[![travis](https://app.travis-ci.com/mikaello/avrodoc-plus.svg?branch=master)](https://travis-ci.com/github/mikaello/avrodoc-plus)

avrodoc-plus is a documentation tool for [Apache Avro](http://avro.apache.org/) schemas.

This project originates from [ept/avrodoc](https://github.com/ept/avrodoc) -> [ckatzorke/avrodoc-plus](https://github.com/ckatzorke/avrodoc-plus) -> [leosilvadev/avrodoc-plus](https://github.com/leosilvadev/avrodoc-plus), which are all great, but receives no further updates.

## Usage

```bash
npm install --global @mikaello/avrodoc-plus | yarn add global @mikaello/avrodoc-plus

avrodoc-plus -i source -o out.html
```

Or without installation:

```bash
npx @mikaello/avrodoc-plus -i source -o out.html
```

## Options

```text
USAGE:
    avrodoc-plus [FLAGS] [OPTIONS] [AVRO FILES...]

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
```

## Enhancements

- support for input folders
- support of schema/type search (search by namespace and/or schema/type)
- support for custom page title
