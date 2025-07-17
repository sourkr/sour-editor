import { ErrorData } from "./base.js"
import Parser from './parser.js';
import DefinationParser from './dparser.js';

export default class Validator {
    globals = Validator.BUILTINS
    
    constructor(code) {
        this.code = code;
        this.errors = [];
        this.parser = new Parser(code);
    }
    
    validate() {
        const { ast, errors } = this.parser.parse();
        this.errors.push(...errors);

        for (const node of ast) {
            this.stmt(node);
        }

        return { ast, errors: this.errors };
    }

    stmt(stmt) {
        if (stmt.type === 'func-call') {
            const name = stmt.name.value
            const funcs = this.globals.get_funcs(name)
            
            if (!funcs.length) {
                this.error(`${name} is not a function`, stmt.name)
                return
            }
            
            const args = stmt.args.list.map(arg => this.expr(arg))
            const argsStr = args.map(arg => arg?.name).join(',')
            
            const errors = []
            let found = null
            
            for(let func of funcs) {
                const params = func.params.map(p => p.type)
                let index = 0
                let found = true
                
                while(params.length) {
                    console.log(params[0], args[index])
                    
                    if (!equalType(params[0], args[index])) {
                        found = false
                        break
                    }
                    
                    params.shift()
                    index++
                }
                
                if (!found) {
                    const paramsStr = func.params.map(p => p.type.name).join(',')
                    errors.push(`${name}(${argsStr}) is not applicable for ${name}(${paramsStr})`)
                } else {
                    found = true
                    return
                }
            }
            
            if (!found) {
                this.error(`Cannot find suitable function call for ${name}(${argsStr})\n\n${errors.join('\n\n')}`, stmt.name)
            }
            
            return
        }
    }
    
    expr(expr) {
        if (expr.type === 'char') return { type: 'simple', name: 'char' }
    }
    
    error(msg, token) {
        this.errors.push(new ErrorData(`CompileError: ${msg}`, token, this.code, this.filepath))
    }
}

function equalType(a, b) {
    if (a?.type !== b?.type) return false
    
    if (a.type === 'simple') {
        return a.name === b.name
    }
    
    return false
}

const dparser = new DefinationParser(await (await fetch('./libs/sourlang/builtin.sour')).text())
dparser.parse()
Validator.BUILTINS = dparser.globals
console.log(Validator.BUILTINS.get_all_funcs())