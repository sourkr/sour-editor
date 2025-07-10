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
        // Store more detailed error objects
        let errorObject = { message: msg };
        if (typeof msg === 'object' && msg.token && msg.message) { // If a rich error object is passed
            errorObject = msg;
        } else if (msg.token) { // If an object with a token and implicit message is passed
             errorObject.message = `Unexpected token '${msg.token.value}'`;
             errorObject.token = msg.token;
        } else { // Simple message string
            errorObject.message = msg;
        }

        // Add token details if not already part of a rich error object
        if (errorObject.token && errorObject.token.start) {
            errorObject.line = errorObject.token.start.lineno;
            errorObject.column = errorObject.token.start.col;
            // errorObject.length = errorObject.token.end.index - errorObject.token.start.index;
        }
        this.#errors.push(errorObject);
    }
    
    file() {
        const token = this.next(); // Consume the token
        this.error({ message: `Unexpected token '${token.value}'`, token: token });
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
        
        // Pass the unexpected token to the error method for more detailed error reporting
        this.error({ message: `Expecting '${this.#token(type)}' but got '${token.value}'`, token: token });
        return token; // Return the problematic token as per original logic, parser might try to recover or stop.
    }
    
    is(type, value) {
        const token = this.#tokens.peek()
        return token.type === type && token.value === (value ?? token.value)
    }
    
    skip() {
        this.#tokens.next()
    }
}