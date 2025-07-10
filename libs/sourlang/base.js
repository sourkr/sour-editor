import { TokenStream } from "./tokens.js"

export class BaseParser {
    #errors = []
    #tokens
    #filepath
    #input
    
    constructor(input, filepath = 'internal.sour') {
        this.#tokens = new TokenStream(input)
        this.#input = input
        this.#filepath = filepath
    }
    
    parse() {
        const ast = []
        while (this.#tokens.has) ast.push(this.file())
        return { ast, errors: this.#errors }
    }
    
    error(msg, token) {
        this.#errors.push(new ErrorData(msg, token, this.#input, this.#filepath));
    }
    
    file() {
        const token = this.next()
        this.error(`ParseError: Unexpected token '${token.value}'`, token)
        return token
    }
    
    peek() {
        return this.#tokens.peek()
    }
    
    #token(type) {
        switch (type) {
            case "ident": return "identifier"
            case "int": return "integer"
            default: return type
        }
    }
    
    next(type) {
        const token = this.#tokens.next()
        
        if (token.type === 'space') return this.next(type)
        
        if (token.err) {
            this.error(`ParseError: ${token.err.msg}`, token.err)
        }
        
        if (!type) return token
        if (token.type === type) return token
        
        this.error(`ParseError: Expecting '${this.#token(type)}' but got '${token.value}'`, token)
        return token;
    }
    
    peek() {
        const token = this.#tokens.peek()
        if (token.type === 'space') {
            this.#tokens.next()
            return this.peek()
        }
        return token
    }
    
    is(type, value) {
        const token = this.peek()
        return token.type === type && token.value === (value ?? token.value)
    }
    
    skip() {
        this.next()
    }
}

class ErrorData {
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