import { TokenStream } from "./tokens.js"

export default class BaseParser {
    #errors = []
    #tokens
    
    constructor(input) {
        this.#tokens = new TokenStream(input)
    }
    
    parse() {
        const ast = []
        while (this.#tokens.has) ast.push(this.file())
        return { ast, errors: this.#errors }
    }
    
    error(msg) {
        this.#errors.push(`ParseError: ${msg}`)
    }
    
    file() {
        // console.log(this.#tokens.next())
        this.error(`Unexpected token '${this.next().value}'.`)
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
        
        if (!type) return token
        if (token.type === type) return token
        
        this.error(`Expecting '${this.#token(type)}' but got '${token.value}'`)
        return token
    }
    
    is(type, value) {
        const token = this.#tokens.peek()
        return token.type === type && token.value === (value ?? token.value)
    }
    
    skip() {
        this.#tokens.next()
    }
}