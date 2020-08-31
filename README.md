## Webpack Recursive Loader
Allows directories to be imported recursively as javascript objects.
Useful for easily loading entire directories recursively to traverse.
For example, can be used to load api endpoints server-side so they can be mounted in an express app.
Supports webpack hot-reloading.

### Installation
```shell script
npm install -D webpack-recursive-loader
```

### Usage
Given a directory structure like  
```
|- api 
|  |- a.js
|  |- subdir  
|     |- b.js  
|- index.js
```

```js
//webpack.config.js
module.exports = {
    //...
    plugins: [
        //...
        new WebpackRecursiveLoaderPlugin()
    ]
    //...
};
```

```js
//api/a.js
export function myFunc(x, y){
    return x * y;
}
```

```js
//api/subdir/b.js
export const myNumber = 7;
```

```js
//index.js
import assert from 'assert';
import * as api from './api?recursive';
import {myFunc} from './api/a';
import {myNumber} from './api/subdir/b';

assert.strictEqual(api.a.myFunc, myFunc);
assert.strictEqual(api.b.subdir.myNumber, myNumber);
```

### Options
* `include` Only includes files/directories which match the given pattern. 
    Directories are included automatically if they don't match the pattern.
    Can be one of the following types:
    * `string` A glob to match against root-relative file paths (not directories).
    * `RegExp` A regex to match against root-relative file paths (not directories).
    * `function: (file: File) -> boolean`
        A custom function to check whether to include the file. 
        See below for `File` properties. 
    * `Array` An array of the preceding to be or-ed together.
* `exclude` Excludes file/directories which match the given pattern. Accepts the same types as `include`.
* `getName: (file: File) -> string` Allows customization over how names are generated for a given file. 
    By default, the name for a particular file is the basename without extension(s).
* `namespace` Changes the namespace to which this plugin applies. 
   By specifying multiple instances of the plugin with different namespaces, you can use multiple configurations side-by-side.
   Namespaces can be specified in the query string like this: `./api?recursive=myNamespace`.
* `keyword` (default `'recursive'`) Allows the keyword which triggers the recursive loader to be changed.

`File` objects have the following properties:
* `type` The type of the object. One of `'file'` or `'directory'`. (Symlinks are not yet supported, sorry.)
* `basename` The basename of the file.
* `path` The root-relative path of the file.
* `absPath` The absolute path of the file.

### Todo
* Support symlinks
* Add documentation example for namespaces

### License
[MIT](./LICENSE)