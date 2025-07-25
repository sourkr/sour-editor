import { ErrorData } from "./base.js"
import Parser from './parser.js';
import BUILTINS from "./builtin.js"
import { node_to_type, clone_type, gen_func_alias } from "./util.js"
import { Scope } from "./scope.js"

const OP_NAMES = new Map([
    ['+', '_add'],
    ['-', '_sub'],
    ['*', '_mul'],
    ['/', '_div'],
    ['%', '_mod'],
    ['==', '_eq'],
    ['>', '_gt'],
    ['<', '_lt'],
])

export default class Validator {
    globals = new Scope(BUILTINS)

    #exports = new BuiltinScope()
    #file
    
    constructor(code, file) {
        this.code = code;
        this.#file = file
        
        this.errors = [];
        this.parser = new Parser(code);
    }
    
    validate() {
        const { ast, errors } = this.parser.parse();
        this.errors.push(...errors);

        for (const node of ast) {
            this.stmt(node, this.globals);
        }

        return { ast, errors: this.errors, exports: this.#exports };
    }

    stmt(stmt, scope) {
        if (stmt.type === 'export') {
            const def = this.stmt(stmt.def, scope)
            def.is_used = true
            this.#exports.def_func(def)
        }
        
        if (stmt.type === 'import') {
            const path = stmt.path.value
            
            if (path == this.#file.base) {
                this.error(`Cannot import itself`, stmt.path)
                return
            }
                
            const file = this.#file.parent.child(path + '.sour')

            if (!file.exists()) {
                this.error(`File ${path} does not exist`, stmt.path)
                return
            }

            const validator = new Validator(file.read(), file)
            const prog = validator.validate()

            for (let err of prog.errors) {
                this.errors.push(err)
            }

            prog.exports.get_all_funcs().forEach(func => {
                this.globals.def_func(func)
            })
        }
        
        if (stmt.type === 'func-dec') {
            const name = stmt.name.value
            const funcs = this.globals.get_funcs(name)
            
            const params = stmt.params.list
                .map(param => {
                    const type = clone_type(this.node_to_type(scope, param.type))
                    param.doc = type
                    type.is_param = true
                    type.param_name = param.name.value
                    
                    return { name: param.name, type }
                })

            // console.log(params);
            
            for (let func of funcs) {
                if (func.params.length !== params.length) continue
                if (!func.params.every((param, i) => equal_type(params[i].type, param.type))) continue
                
                
                const paramStr = params
                    .map(p => p.type)
                    .map(type_to_str)
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
                retType: this.node_to_type(scope, stmt.retType),
                doc: stmt.doc
            }
            
            this.globals.def_func(func)
            stmt.doc = func
            
            stmt.alias = stmt.doc.alias = gen_func_alias(func)
            
            const funcScope = new Scope(scope)
            params.forEach(param => funcScope.def_var(param.name.value, param.type))
            this.validate_body(stmt.body.list, funcScope)
            
            return func
        }
        
        if (stmt.type === 'if') {
            const cond = this.expr(stmt.cond, scope)
            
            if (cond?.name !== 'bool') {
                this.error(`The contition must be a 'bool' but got '${type_to_str(cond)}'`, stmt.cond)
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
            
            if (cond?.name !== 'bool') {
                this.error(`The contition must be a 'bool' but got '${type_to_str(cond)}'`, stmt.cond)
            }
            
            this.expr(stmt.inc, scope)
            
            this.validate_body(stmt.body.list, scope)
            
            return
        }
        
        if (stmt.type === 'var-dec') {
            const type = clone_type(this.expr(stmt.val, scope))

            // console.log(stmt.val, type)
            
            if (type) {
                stmt.doc = type
                type.is_var = true
                type.var_name = stmt.name.value
                scope?.def_var?.(stmt.name.value, type)
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
        if (!expr) return
        
        if (expr.type === 'func-call') {
            const args = expr.args.list.map(arg => this.expr(arg, scope))
            const errors = []

            let access
            let func
            
            if (expr.access.type === 'ident') {
                const name = access = expr.access.value

                if (!scope.has_func(name)) {
                    this.error(`'${name}' is not a function`, expr.access)
                    return
                }

                func = get_suitable_func(scope.get_funcs(name), access, args, errors)
            } else if (expr.access.type === 'dot') {
                const left = this.expr(expr.access.left, scope)
                const name = expr.access.right.value

                if (is_error_type(left)) {
                    return { type: 'simple', name: 'error' }
                }

                access = `${type_to_str(left)}.${name}`

                if (!left.cls.scope.has_meths(name)) {
                    this.error(`'${name}' is not a method of ${type_to_str(left)}`, expr.access.right)
                    return { type: 'simple', name: 'error' }
                }

                func = get_suitable_func(left.cls.scope.get_meths(name), access, args, errors)
            }
            
            if (!func) {
                // console.log(errors)
                const argsStr = args.map(type_to_str).join(',')
                this.error(`Cannot find suitable function call for ${access}(${argsStr})\n\n${errors.join('\n\n')}`, expr.access)
                return { type: 'simple', name: 'error' }
            }
            
            func.is_used = true
            expr.alias = func.alias
            expr.doc = func
            
            return func.retType
        }

        if (expr.type === 'new') {
            const name = expr.name.value

            if (!scope.has_class(name)) {
                this.error(`'${name}' is not a class`, expr.name)
                return { type: 'simple', name: 'error' }
            }

            const cls = expr.doc = scope.get_class(name)

            if (cls.generic) {
                if (!expr.generic) {
                    this.error(`'${name}' is a generic class`, expr.name)
                    return { type: 'simple', name: 'error' }
                }

                if (cls.generic.length !== expr.generic.list.length) {
                    this.error(`'${name}' expects ${cls.generic.length} generic arguments`, expr.name)
                    return { type: 'simple', name: 'error' }
                }

                const generic = expr.generic.list.map((type) => this.node_to_type(scope, type))

                return { type: 'ins', cls, generic }
            }

            return cls
        }
        
        if (expr.type === 'op') {
            const left = this.expr(expr.left, scope)
            const right = this.expr(expr.right, scope)
            const name = OP_NAMES.get(expr.op?.value)

            if (is_error_type(left) || is_error_type(right)) {
                return { type: 'simple', name: 'error' }
            }
            
            const func = get_suitable_func(left.scope.get_meths(name), name, [right])
            
            if (func) {
                expr.alias = func.alias
                return func.retType
            }

            this.error(`${type_to_str(left)} ${expr.op.value} ${type_to_str(right)} is not a valid opeator`, expr.op)
        }
    
        if (expr.type === 'dot') {
            const left = this.expr(expr.left, scope)

            if (is_error_type(left)) {
                return { type: 'simple', name: 'error' }
            }

            const name = expr.right.value

            // console
            if (!left.cls.scope.has_prop(name)) {
                this.error(`'${name}' is not a property of ${type_to_str(left)}`, expr.right)
                return { type: 'simple', name: 'error' }
            }

            return expr.right.doc = left.cls.scope.get_prop(name)
        }

        if (expr.type === 'unary') {
            const type = this.expr(expr.expr, scope)
            
            if (is_error_type(type)) {
                return { type: 'simple', name: 'error' }
            }

            if (expr.op === '++') {
                const type = this.expr(expr.expr, scope)
                const func = get_suitable_func(type.scope.get_meths('_add'), '_add', [type])

                expr.expr.doc = type

                if (!func) {
                    this.error(`'${type_to_str(type)}' is not incrementable`, expr.expr)
                    return { type: 'simple', name: 'error' }
                }

                if (!equal_type(func.retType, type)) {
                    this.error(`'${type_to_str(type)}' is not incrementable`, expr.expr)
                    return { type: 'simple', name: 'error' }
                }

                expr.alias = func.alias
                return type
            }
        }

        if (expr.type === 'index') {
            const access = this.expr(expr.access, scope)
            const index = this.expr(expr.expr, scope)

            if (is_error_type(access) || is_error_type(index)) {
                return { type: 'simple', name: 'error' }
            }

            const func = get_suitable_func(access.cls.scope.get_meths('_get'), '_get', [index])
            
            if (func) {
                expr.alias = func.alias
                return func.retType
            }

            this.error(`${type_to_str(access)}[${type_to_str(index)}] is not a valid index`, expr.startTok)
        }
        
        if (expr.type === 'char') {
            return scope.get_class('char')
        }

        if (expr.type === 'str') {
            const cls = scope.get_class('string')
            return { type: 'ins', cls }
        }

        if (expr.type === 'num') {
            return scope.get_class('byte')
        }
        
        if (expr.type === 'ident') {
            const name = expr.value
            
            if (scope.has_var(name)) {
                const type = scope.get_var(name)
                expr.doc = type
                type.is_used = true
                return type
            }
            
            this.error(`Variable ${name} is not defined`, expr)
            return { type: 'simple', name: 'error' }
        }

        return { type: 'simple', name: 'error' }
    }
    
    error(msg, token) {
        this.errors.push(new ErrorData(`CompileError: ${msg}`, token, this.code, this.filepath))
    }
    
    node_to_type(scope, node) {
        if (!node) return

        if (node.type === 'simple') {
            if (node.name.value === 'void') {
                return node.doc = { type: 'simple', name: 'void' }
            }

            if (!scope.has_class(node.name.value)) {
                this.error(`Type ${node.name.value} is not defined`, node.name)
                return { type: 'simple', name: 'error' }
            }

            const cls = scope.get_class(node.name.value)
            return node.doc = { type: 'ins', cls }
        }

        return { type: 'simple', name: 'error' }
    }
    
    /** @deprecated */
    toType(type) {
        if (type.type === 'simple') {
            return { type: 'simple', name: type.name.value }
        }
    }
}

function get_suitable_func(funcs, name, args, errors = []) {
    for(let func of funcs) {
        const params = func.params.map(p => p.type)
        let index = 0
        let found = true

        while(params.length) {
            if (!equal_type(params[0], args[index])) {
                found = false
                break
            }

            params.shift()
            index++
        }

        if (!found) {
            const paramsStr = func.params.map(p => type_to_str(p.type)).join(',')
            const argsStr = args.map(type_to_str).join(',')
            
            errors.push(`${name}(${argsStr}) is not applicable for ${name}(${paramsStr})`)
        } else {
            return func
        }
    }
}

function type_to_str(type) {
    if (type.type === 'simple') {
        return type.name
    }

    if (type.type === 'class') {
        return type.name
    }

    if (type.type === 'ins') {
        return type.cls.name
    }
}

function equal_type(a, b) {
    if (a?.type !== b?.type) return false

    if (a.type === 'simple') {
        return a.name === b.name
    }

    if (a.type === 'class') {
        return a.name === b.name
    }

    if (a.type === 'ins') {
        return a.cls.name === b.cls.name
    }
}

function is_error_type(type) {
    if (!type) return true
    return type.name === 'error'
}

/** @deprecated */
function typeToStr(type, alias) {
    if (type?.type == 'simple') {
        return type.name
    }
}

/** @deprecated */
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
        this.#funcs.add(func)
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

    // Classes
    has_class(name) {
        return this.#parent.has_class(name)
    }

    get_class(name) {
        return this.#parent.get_class(name)
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