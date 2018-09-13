# avrodoc-plus

avrodoc-plus is a documentation tool for [Avro](http://avro.apache.org/) schemas.  
This project originates from [https://github.com/ept/avrodoc](https://github.com/ept/avrodoc), which is great, but received no further updates.

## Usage

```bash
npm install global @ckatzorke/avrodoc-plus
avrodoc-plus -i source -o out.html
```

### Options

* -i *sourcefolder*  
   Pass in a source folder that will recursively parsed and crawled for avsc files
* -o *outputfile*  
  The file where the generated doc should be written to

### Enhancements

- support for input folders
