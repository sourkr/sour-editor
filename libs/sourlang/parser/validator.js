import { ErrorData } from "./base.js"
import Parser from './parser.js';
import BUILTINS from "./builtin.js"

const TYPES = {
    BYTE: { type: 'simple', name: 'byte' },
    CHAR: { type: 'simple', name: 'char' },
    BOOL: { type: 'simple', name: 'bool' },
}

export default class Validator {
    globals = new GlobalScope(BUILTINS)
    
    constructor(code) {
        this.code = code;
        this.errors = [];
        this.parser = new Parser(code);
    }
    
    validate() {
        const { ast, errors } = this.parser.parse();
        this.errors.push(...errors);

        for (const node of ast) {
            this.stmt(node, this.globals);
        }

        return { ast, errors: this.errors };
    }

    stmt(stmt, scope) {
        if (stmt.type === 'func-dec') {
            const name = stmt.name.value
            const funcs = this.globals.get_funcs(name)
            
            const params = stmt.params.list
                .map(param => {
                    const type = this.toType(param.type)
                    param.doc = type
                    type.is_param = true
                    type.param_name = param.name.value
                    
                    return { name: param.name, type }
                })
            
            for (let func of funcs) {
                if (func.params.length !== params.length) continue
                if (!func.params.every((param, i) => equalType(params[i].type, param.type))) continue
                
                
                const paramStr = params
                    .map(p => p.type)
                    .map(typeToStr)
                    .join(',')
                
                this.error(`Function ${name}(${paramStr}) is already defined`, stmt.name)
                return
            }
            
            const names = new Set()
            
            for(let param of params) {
                const name = param.name.value
                
                if (names.has(name)) {
                    this.error(`Parameter ${name} is already defined`, param.name)
                    return
                }
                
                names.add(name)
            }
            
            const func = {
                type: 'func',
                name,
                params: params.map(p => { return { type: p.type, name: p.name.value } }),
                retType: this.toType(stmt.retType),
                doc: stmt.doc
            }
            
            this.globals.def_func(func)
            stmt.doc = func
            
            stmt.alias = stmt.doc.alias = `${name}__${params.map(p => typeToStr(p.type)).join('__')}`
            
            const funcScope = new FunctionScope(scope)
            params.forEach(param => funcScope.def_var(param.name.value, param.type))
            this.validate_body(stmt.body.list, funcScope)
            
            return
        }
        
        if (stmt.type === 'if') {
            const cond = this.expr(stmt.cond, scope)
            
            if (!equalType(cond, TYPES.BOOL)) {
                this.error(`The contition must be a 'bool'`, stmt.cond)
            }
            
            this.validate_body(stmt.body.list, scope)
            
            if (stmt.elseStmt) {
                this.validate_body(stmt.elseStmt.body.list, scope)
            }
            
            return
        }
        
        if (stmt.type === 'for') {
            this.stmt(stmt.init, scope)
            
            const cond = this.expr(stmt.cond, scope)
            
            if (!equalType(cond, TYPES.BOOL)) {
                this.error(`The contition must be a 'bool'`, stmt.cond)
            }
            
            this.expr(stmt.inc, scope)
            
            this.validate_body(stmt.body.list, scope)
            
            return
        }
        
        if (stmt.type === 'var-dec') {
            const type = this.expr(stmt.val, scope)
            
            if (type) {
                stmt.doc = type
                type.is_var = true
                type.var_name = stmt.name.value
                scope.def_var(stmt.name.value, type)
            }
            
            return
        }
        
        this.expr(stmt, scope)
    }
    
    validate_body(body, scope) {
        for (const node of body) {
            this.stmt(node, scope);
        }
    }

    expr(expr, scope) {
        if (expr.type === 'func-call') {
            const name = expr.name.value

            if (!this.globals.has_func(name)) {
                this.error(`'${name}' is not a function`, expr.name)
                return
            }
            
            const funcs = this.globals.get_funcs(name)
                        
            const args = expr.args.list.map(arg => this.expr(arg, scope))
            const argsStr = args.map(arg => arg?.name).join(',')
            
            const errors = []
            let found = null
            
            for(let func of funcs) {
                const params = func.params.map(p => p.type)
                let index = 0
                let found = true
                
                while(params.length) {
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
                    func.is_used = true
                    expr.alias = func.alias
                    return func.retType
                }
            }
            
            if (!found) {
                this.error(`Cannot find suitable function call for ${name}(${argsStr})\n\n${errors.join('\n\n')}`, expr.name)
            }
            
            return
        }
        
        if (expr.type === 'op') {
            if (expr.op?.value === '+') {
                const left = this.expr(expr.left, scope)
                const right = this.expr(expr.right, scope)
                
                if (equalType(left, TYPES.CHAR) && equalType(right, TYPES.BYTE)) return TYPES.CHAR
                
                this.error(`'${typeToStr(left)}' + '${typeToStr(right)}' is not a valid operator`, expr.op)
                return
            }
            
            if (expr.op?.value === '<' || expr.op?.value === '>') {
                const left = this.expr(expr.left, scope)
                const right = this.expr(expr.right, scope)
                
                if (equalType(left, TYPES.BYTE) && equalType(right, TYPES.BYTE)) return TYPES.BOOL
                
                this.error(`'${typeToStr(left)}' + '${typeToStr(right)}' is not a valid operator`, expr.op)
                return
            }
            
            if (expr.op?.value === '%') {
                const left = this.expr(expr.left, scope)
                const right = this.expr(expr.right, scope)
                
                if (equalType(left, TYPES.BYTE) && equalType(right, TYPES.BYTE)) return TYPES.BYTE
                
                this.error(`'${typeToStr(left)}' + '${typeToStr(right)}' is not a valid operator`, expr.op)
                return
            }
            
            if (expr.op?.value === '/') {
                const left = this.expr(expr.left, scope)
                const right = this.expr(expr.right, scope)
                
                if (equalType(left, TYPES.BYTE) && equalType(right, TYPES.BYTE)) return TYPES.BYTE
                
                this.error(`'${typeToStr(left)}' + '${typeToStr(right)}' is not a valid operator`, expr.op)
                return
            }
        }

        if (expr.type === 'char') {
            return scope.get_class('char')
        }

        if (expr.type === 'str') {
            return scope.get_class('string')
        }

        if (expr.type === 'num') {
            return scope.get_class('byte')
        }
        
        if (expr.type === 'ident') {
            const name = expr.value
            
            if (scope.has_var(name)) {
                const type = scope.get_var(name)
                type.is_used = true
                return type
            }
            
            this.error(`Variable ${name} is not defined`, expr)
            return { type: 'simple', name: 'error' }
        }
    }
    
    error(msg, token) {
        this.errors.push(new ErrorData(`CompileError: ${msg}`, token, this.code, this.filepath))
    }
    
    toType(type) {
        if (type.type === 'simple') {
            return { type: 'simple', name: type.name.value }
        }
    }
}

function typeToStr(type, alias) {
    if (type?.type == 'simple') {
        return type.name
    }
}

function equalType(a, b) {
    if (a?.type !== b?.type) return false
    
    if (a.type === 'simple') {
        return a.name === b.name
    }

    if (a.type === 'class') {
        return a.name === b.name
    }
    
    return false
}

export class GlobalScope {
    #funcs = new Set()
    #parent
    
    constructor(builtins) {
        this.#parent = builtins
    }

    // Classes
    has_class(name) {
        return this.#parent.has_class(name)
    }

    get_class(name) {
        return this.#parent.get_class(name)
    }

    get_all_classes() {
        return this.#parent.get_all_classes()
    }
    
    // funcs
    def_func(func) {
        this.#funcs.push(func)
    }
    
    has_func(name) {
        return this.get_all_funcs()
            .some(func => func.name === name)
    }
    
    get_funcs(name) {
        return this.get_all_funcs()
            .filter(func => func.name === name)
    }
    
    get_all_funcs() {
        return concat(this.#funcs.values(), this.#parent.get_all_funcs())
    }
    
    // vars
    has_var() {
        return false
    }
    
    get_all_vars() {
        return []
    }
}

export class FunctionScope {
    #vars = new Map()
    
    #parent
    
    constructor(builtins) {
        this.#parent = builtins
    }
    
    // funcs
    has_func(name) {
        return this.#parent.has_func()
    }
    
    get_funcs(name) {
        return this.#parent.get_funcs(name)
    }
    
    get_all_funcs() {
        return this.#parent.get_all_funcs()
    }
    
    
    // vars
    def_var(name, type) {
        this.#vars.set(name, type)
    }
    
    has_var(name) {
        return this.#vars.has(name)
    }
    
    get_var(name) {
        return this.#vars.get(name)
    }
    
    get_all_vars() {
        return this.#vars.entries()
            .map(e => { return { name: e[0], type: e[1] } })
    }
}

class BuiltinScope {
    #funcs = []
    #classes = new Map()
    
    // functions
    def_func(func) {
        this.#funcs.push(func)
    }
    
    has_func(name) {
        return this.get_all_funcs()
            .some(func => func.name === name)
    }
    
    get_funcs(name) {
        return this.get_all_funcs()
            .filter(func => func.name === name)
    }
    
    get_all_funcs() {
        return this.#funcs
    }
    
    // classes 
    def_class(name, klass) {
        this.#classes.set(name, klass)
    }
    
    has_class(name) {
        return this.#classes.has(name)
    }
    
    get_class(name) {
        return this.#classes.get(name)
    }
    
    get_all_classes() {
        return this.#classes.entries()
            .map(e => { return { name: e[0], class: e[1] } })
    }
}

function *concat(...iterators) {
    for (let iterator of iterators) {
        for (let item of iterator) {
            yield item
        }
    }
}