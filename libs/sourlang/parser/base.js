import { TokenStream } from "./tokens.js"

export class BaseParser {
    #errors = []
    #tokens
    #filepath
    #input
    
    #scopes = []
    
    constructor(input, filepath = 'internal.sour') {
        this.#tokens = new TokenStream(input)
        this.#input = input
        this.#filepath = filepath
    }
    
    scope(parse, ...args) {
        this.#scopes.push({ hasError: false })
        const res = parse.call(this, ...args)
        const scope = this.#scopes.pop()
        
        res.start = res.start || scope.firstTok.start
        res.end = res.end || scope.lastTok.end
        
        return res
    }
    
    hasError() {
        return this.#scopes.at(-1).hasError
    }
    
    parse() {
        const ast = []
        while (this.more()) ast.push(this.scope(this.file))
        return { ast, errors: this.#errors }
    }
    
    error(msg, token) {
        this.#errors.push(new ErrorData(msg, token, this.#input, this.#filepath));
        
        if (this.#scopes.length) {
            this.#scopes.at(-1).hasError = true
        }
    }
    
    file() {
        const token = this.next()
        this.error(`ParseError: Unexpected token '${token.value}'`, token)
        return token
    }
    
    more() {
        if (this.peek().type === 'eof') {
            return false
        }
        
        if (this.peek().type === 'space') {
            this.#tokens.next()
            return this.more()
        }
        
        return this.#tokens.has
    }
    
    get has() {
        if (this.peek().type === 'space') {
            this.#tokens.next()
            return this.has
        }
        
        return this.#tokens.has
    }
    
    
    #token(type, value) {
        switch (type) {
            case "ident": return "identifier"
            case "int": return "integer"
            case "punc": return value || type
            default: return type
        }
    }
    
    next(type, value) {
        const token = this.#tokens.next()
        
        if (token.type === 'space') return this.next(type)
        
        if (token.type === 'comment') {
            this.lastComment = token;
            return this.next(type)
        }
        
        if (token.err) {
            this.error(`ParseError: ${token.err.msg}`, token.err)
        }
        
        
        if (!this.#scopes.at(-1).firstTok) {
            this.#scopes.at(-1).firstTok = token
        }
        
        this.#scopes.at(-1).lastTok = token
        
        if (!type) return token
        
        if (token.type === type && token.value === (value ?? token.value)) {
            return token
        }
    
        this.error(`ParseError: Expecting '${this.#token(type, value)}' but got '${token.value}'`, token)
        return token;
    }
    
    peek() {
        const token = this.#tokens.peek()
        
        if (token.type === 'space') {
            this.#tokens.next()
            return this.peek()
        }
        
        if (token.type == 'comment') {
            this.lastComment = token
            this.#tokens.next()
            return this.peek()
        }
        
        return token
    }
    
    is(type, value) {
        const token = this.peek()
        return token.type === type && token.value === (value ?? token.value)
    }
    
    skip(type, value) {
        this.next(type, value)
    }
}

export class ErrorData {
    #code
    
    constructor(message, token, code, filepath) {
        this.message = message
        this.start = token.start
        this.end = token.end
        this.filepath = filepath
        
        this.#code = code
    }
    
    toString() {
        const lineno = this.start.lineno.toString()
        const line1 = ` ${lineno} | ${this.#code.split('\n')[this.start.lineno - 1]}`
        const line2 = ` ${repeat(' ', lineno.length)}   ${repeat(' ', this.start.col-1)}${repeat('^', Math.max(1, this.end.col - this.start.col))}`
        const end = `in ${this.filepath} at ${this.start}`
        
        return `${this.message}\n${line1}\n${line2}\n${end}`
    }
}

function repeat(str, count) {
    return new Array(count).fill(str).join('')
}