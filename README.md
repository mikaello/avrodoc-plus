# avrodoc-plus

avrodoc-plus is a documentation tool for [Apache Avro](http://avro.apache.org/) schemas.

This project originates from [ept/avrodoc](https://github.com/ept/avrodoc) -> [ckatzorke/avrodoc-plus](https://github.com/ckatzorke/avrodoc.plus) -> [leosilvadev/avrodoc-plus](https://github.com/leosilvadev/avrodoc-plus), which are great, but received no further updates.

## Usage

```bash
npm install --global mikaello/avrodoc-plus#v1 | yarn add global mikaello/avrodoc-plus#v1
avrodoc-plus -i source -o out.html
```

### Options

- -i _sourcefolder_  
  Pass in a source folder that will recursively parsed and crawled for avsc files

- -o _outputfile_  
  The file where the generated doc should be written to
- -s _external stylesheet less file_  
  Your own less file, used to override specific style of your generated page

### Enhancements

- support for input folders
- support of schema/type search (search by namespace and/or schema/type)
