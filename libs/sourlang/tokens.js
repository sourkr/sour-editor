import { CharStream, EOF } from "./chars.js"

const KEYWORDS = new Set(['print'])

export class TokenStream {
    #chars
    #start
    #token
    
    constructor(input) {
        this.#chars = new CharStream(input)
    }
    
    peek() {
        if (this.#token) return this.#token
        return this.#token = this.#next()
    }
    
    next() {
        if (this.#token) {
            const temp = this.#token
            this.#token = null
            return temp
        }
        
        return this.#next()
    }
    
    get has() {
        if (this.#token) return true;
        return this.#chars.has
    }
    
    #next() {
        const char = this.#chars.peek()
        
        this.#start = this.#chars.position
        
        if (/\s/.test(char)) {
            return this.#tok("space", this.#read(this.#space))
        }
        
        if (/[a-zA-Z]/.test(char)) {
            const ident = this.#read(this.#ident)
            return this.#tok(KEYWORDS.has(ident) ? "kw" : "ident", ident)
        }
        
        if (/[0-9]/.test(char)) {
            return this.#tok("int", this.#read(this.#int))
        }
        
        if (char === '"') {
            this.#chars.next()
            const str = this.#read(() => this.#chars.peek() !== '"' || this.#chars.peek() !== EOF)
            return this.#tok("str", str.slice(1, -1))
        }
        
        if (char === EOF) {
            return this.#tok("eof", "end of file")
        }
        
        return this.#tok("unk", this.#chars.next())
    }
    
    #ident() {
        return /[a-zA-Z0-9_]/.test(this.#chars.peek())
    }
    
    #int() {
        return /[0-9]/.test(this.#chars.peek())
    }
    
    #space() {
        return /\s/.test(this.#chars.peek())
    }
    
    #tok(type, value) {
        const tok = new Token(type, value)
        tok.start = this.#start
        tok.end = this.#chars.position
        return tok
    }
    
    #read(predicate) {
        let str = ''
        
        while (this.#chars.has && predicate.call(this)) {
            str += this.#chars.next()
        }
        
        return str
    }
}

class Token {
    constructor(type, value, source) {
        this.type = type
        this.value = value
        this.source = source ?? value 
    }
}