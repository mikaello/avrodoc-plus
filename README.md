# avrodoc-plus

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

### Options

- -i _sourcefolder_  
  Pass in a source folder that will recursively parsed and crawled for avsc files
- -o _outputfile_  
  The file where the generated doc should be written to
- --title _Avrodoc for ACME_  
  The title that will be used in the generated HTML page, deafults to _Avrodoc_.
- -s _external stylesheet less file_  
  Your own less file, used to override specific style of your generated page
- --ignore-invalid  
  Ignore avsc files that can not be parsed as JSON (instead of quiting)

### Enhancements

- support for input folders
- support of schema/type search (search by namespace and/or schema/type)
