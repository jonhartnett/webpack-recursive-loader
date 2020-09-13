import {getOptions} from 'loader-utils';
import * as t from '@babel/types';
import generate from '@babel/generator';
import { map, toQueryString } from './util';
import Path from 'path';
import {promisify} from 'util';

export default function WebpackRecursiveLoader(source){
    let {
        fileSystem=this.fs,
        plugin,
        root,
        path: dirPath
    } = getOptions(this);

    const readDirAsync = promisify(::fileSystem.readdir);
    const statAsync = promisify(::fileSystem.stat);

    let callback = this.async();

    (async () => {
        let absDirPath = Path.join(root, dirPath);

        this.addContextDependency(absDirPath);

        let entries = await readDirAsync(absDirPath);

        //get stats for all entries
        entries = await Promise.all(entries::map(async entry => {
            let stats = await statAsync(Path.join(absDirPath, entry));
            stats.name = entry;
            return stats;
        }));

        let dependencies = [];
        let keys = new Map();
        let body = [];
        for(let entry of entries){
            let type;
            if(entry.isFile())
                type = 'file';
            else if(entry.isDirectory())
                type = 'directory';
            else
                continue;
            let basename = entry.name;
            let path = Path.join(dirPath, basename);
            let absPath = Path.join(root, path);
            let file = { basename, path, absPath, type };
            let name = plugin._getNameForFile(file);
            if(name == null)
                continue;
            let filePath = absPath;
            if(type === 'directory'){
                let query = toQueryString({
                    [plugin.keyword]: plugin.namespace,
                    root
                });
                filePath = `${filePath}?${query}`;
            }
            dependencies.push(filePath);
            if(keys.has(name))
                throw new Error(`Naming conflict for name '${name}':\n${path}\n${keys.get(name)}`);
            keys.set(name, path);
            //add import statement
            body.push(
                t.importDeclaration(
                    [t.importNamespaceSpecifier(
                        t.identifier(name)
                    )],
                    t.stringLiteral(filePath)
                )
            );
        }

        //export all the keys
        if(keys.size > 0){
            body.push(
                t.exportNamedDeclaration(null, [
                    ...keys.keys()::map(key => {
                        key = t.identifier(key);
                        return t.exportSpecifier(key, key);
                    })
                ])
            );
        }

        //add hot reload support
        let hot = t.memberExpression(t.identifier('module'), t.identifier('hot'));
        body.push(t.ifStatement(hot,
            t.blockStatement([
                t.expressionStatement(t.callExpression(
                    t.memberExpression(hot, t.identifier('accept')),
                    [t.arrayExpression([
                        ...dependencies::map(dep => t.stringLiteral(dep))
                    ])]
                ))
            ])
        ));

        let ast = t.program(body, [], 'module');

        source = generate(ast).code;

        callback(null, source);
    })().catch(err => callback(err));
}