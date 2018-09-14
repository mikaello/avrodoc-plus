avrodoc-plus
=======

avrodoc-plus is a documentation tool for [Avro](http://avro.apache.org/) schemas.  
This project originates from [https://github.com/ept/avrodoc](https://github.com/ept/avrodoc), which is great, but received no further updates.

Biggest change here is, that it supports an input folder as source, that will be scanned recursively for *.avsc files.

Usage

```bash
npm install --global @ckatzorke/avrodoc-plus | yarn add global @ckatzorke/avrodoc-plus
avrodoc-plus -i source -o out.html
```
