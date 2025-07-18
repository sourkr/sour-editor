import { CharStream, EOF } from "./chars.js"

const KEYWORDS = new Set(['func', 'if', 'else', 'for', 'var'])

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

        if (char === '/' && this.#chars.peek(1) === '/') {
            this.#chars.next();
            this.#chars.next();
            let comment = "";
            while (this.#chars.has && this.#chars.peek() !== '\n') {
                comment += this.#chars.next();
            }
            return this.#tok("comment", comment);
        }

        if (char === '/' && this.#chars.peek(1) === '*') {
            this.#chars.next();
            this.#chars.next();
            let comment = "";
            while (this.#chars.has && (this.#chars.peek() !== '*' || this.#chars.peek(1) !== '/')) {
                comment += this.#chars.next();
            }
            if (this.#chars.has) {
                this.#chars.next();
                this.#chars.next();
            }
            return this.#tok("comment", comment);
        }
        
        if (/[a-zA-Z_]/.test(char)) {
            const ident = this.#read(this.#ident)
            return this.#tok(KEYWORDS.has(ident) ? "kw" : "ident", ident)
        }
        
        if (/[0-9]/.test(char)) {
            return this.#tok("num", this.#read(this.#int))
        }
        
        if (/[(,){:};.]/.test(char)) {
            return this.#tok("punc", this.#chars.next())
        }
        
        if (/[<+>%\/=]/.test(char)) {
            return this.#tok("op", this.#chars.next())
        }

        if (char === "'") {
            let charValue = ""
            this.#chars.next()
            charValue = this.#chars.next()
            
            if (charValue == "'") {
                const token = this.#tok("char", '')
                
                token.err =  {
                    msg: "Missing char value",
                    start: this.#chars.position.sub(1),
                    end: this.#chars.position
                }
                
                return token
            }
            
            if (this.#chars.peek() === '\'') {
                this.#chars.next(); // Consume the closing quote
                return this.#tok("char", charValue, `'${charValue}'`)
            } else {
                const token = this.#tok("char", charValue)
                token.err =  {
                    msg: "Unterminated char",
                    start: this.#chars.position.sub(1),
                    end: this.#chars.position
                }
                token.unmatched = true
                return token
            }
        }

        if (char === '"') {
            let strValue = "";
            this.#chars.next(); // Consume the opening quote
            while (this.#chars.has && this.#chars.peek() !== '"' && this.#chars.peek() !== EOF) {
                strValue += this.#chars.next();
            }
            if (this.#chars.peek() === '"') {
                this.#chars.next(); // Consume the closing quote
                return this.#tok("str", strValue)
            } else {
                const token = this.#tok("str", strValue)
                token.err =  {
                    msg: "Unterminated string",
                    start: this.#chars.position.sub(1),
                    end: this.#chars.position
                }
                return token
            }
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
    
    #tok(type, value, source = value) {
        const tok = new Token(type, value, source)
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