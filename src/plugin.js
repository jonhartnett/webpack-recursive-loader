import { fromQueryString, toQueryString, cacheDecorator } from './util';
import Path from 'path';
import {match as globMatch} from 'miniglob';

export function defaultGetFileName({ basename, path, absPath, type }){
    switch(type){
        case 'file':
            //remove extension(s)
            let i = basename.indexOf('.', 1);
            if(i !== -1)
                basename = basename.slice(0, i);
            return basename;
        case 'symlink':
        case 'directory':
            return basename;
        default:
            throw new Error('Not implemented');
    }
}

export function normalizeFilePattern(pattern, fallback){
    function* unpack(pattern){
        if(pattern == null){
            //yield nothing
        }else if(typeof pattern === 'string'){
            yield function(file){
                if(globMatch(pattern, '/' + file.path))
                    return true;
                if(file.type !== 'file')
                    return null;
                return false;
            };
        }else if(pattern instanceof RegExp){
            yield function(file){
                if(pattern.test(file.path))
                    return true;
                if(file.type !== 'file')
                    return null;
                return false;
            };
        }else if(pattern instanceof Function){
            yield pattern;
        }else if(pattern instanceof Array){
            for(let subPattern of pattern)
                yield* unpack(subPattern);
        }else{
            throw new Error(`Invalid pattern type: ${pattern}`);
        }
    }
    let parts = [...unpack(pattern)];
    return function(file){
        let answer = fallback;
        for(let part of parts){
            answer = part(file) ?? answer;
            if(answer)
                return true;
        }
        return answer;
    };
}

export class WebpackRecursiveLoaderPlugin {
    constructor({ keyword='recursive', namespace=null, include=null, exclude=null, getName=defaultGetFileName, suppressRemovedError=false }={}) {
        if(['fileSystem', 'plugin', 'namespace', 'root', 'path'].includes(keyword))
            throw new Error(`Invalid keyword: ${keyword}`);
        this.keyword = keyword;
        this.namespace = namespace ?? true;
        this.include = normalizeFilePattern(include, true);
        this.exclude = normalizeFilePattern(exclude, false);
        this.getName = getName;
        this.suppressRemovedError = suppressRemovedError;
    }

    get name(){
        return WebpackRecursiveLoaderPlugin.name;
    }

    _getNameForFile(file){
        if(!this.include(file))
            return null;
        if(this.exclude(file))
            return null;
        let name = this.getName(file);
        if(/[^\p{L}$_0-9]/u.test(name))
            throw new Error(`Invalid name '${name}'. Cannot contain invalid characters. To resolve, please specify a custom getName function.`);
        if(/^\d/.test(name))
            throw new Error(`Invalid name '${name}'. Cannot start with digit. To resolve, please specify a custom getName function.`);
        return name;
    }

    apply(compiler){
        compiler.hooks.normalModuleFactory.tap(this.name, normalModuleFactory => {
            let nullPath = require.resolve('../null');
            let loaderPath = require.resolve('./loader');
            let normalResolver = normalModuleFactory.getResolver('normal');

            normalModuleFactory.hooks.beforeResolve.tap({
                name: this.name,
                stage: 1 //apply before other stuff so we intercept the keyword
            }, data => {
                let i = data.request.lastIndexOf('?');
                if(i === -1)
                    return;
                let query = fromQueryString(data.request.slice(i + 1));
                if(query[this.keyword] !== this.namespace)
                    return;
                let path = Path.resolve(data.context, data.request.slice(0, i));
                query = toQueryString({
                    ...query,
                    path
                });
                data.request = `!!${loaderPath}?${query}!${nullPath}`;
            });
            normalModuleFactory.hooks.afterResolve.tap(this.name, data => {
                if(data.resource !== nullPath)
                    return;
                for(let loader of data.loaders){
                    if(loader.loader === loaderPath){
                        let options = fromQueryString(loader.options);
                        if(options[this.keyword] !== this.namespace)
                            return;
                        delete options[this.keyword];

                        if('root' in options){
                            options.path = Path.relative(options.root, options.path);
                        }else{
                            //top level recursive, start a new root
                            options.root = options.path;
                            options.path = '.';
                        }
                        options.fileSystem = normalResolver.fileSystem;
                        options.plugin = this;

                        loader.ident = loader.options;
                        loader.options = options;
                        return;
                    }
                }
                if(!this.suppressRemovedError)
                    throw new Error(`Requested 'webpack-recursive-loader/null', but loader is missing! Maybe the loader was removed by another plugin? If you meant to remove it, specify suppressRemovedError to suppress this error.`);
            });
        });
    }
}
WebpackRecursiveLoaderPlugin.prototype._getNameForFile = cacheDecorator(file => `${file.type},${file.path}`)(WebpackRecursiveLoaderPlugin.prototype._getNameForFile);
