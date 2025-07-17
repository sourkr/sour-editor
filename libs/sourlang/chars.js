export const EOF = ''.charAt(0)

export class CharStream {
    #position = new Position(0, 1, 1)
    #input
    
    constructor(input) {
        this.#input = input
    }
    
    peek(n = 0) {
        return this.#input.charAt(this.#position.index + n)
    }
    
    next() {
        const char = this.#input.charAt(this.#position.index++)
        
        if (char == '\n') {
            this.#position.line++
            this.#position.col = 0
        }
        
        this.#position.col++
        return char
    }
    
    get has() {
        return this.#position.index < this.#input.length
    }
    
    get position() {
        return this.#position.clone()
    }
}

class Position {
    constructor(index, lineno, col) {
        this.index = index
        this.lineno = lineno
        this.col = col
    }
    
    clone() {
        return new Position(this.index, this.lineno, this.col)
    }
    
    sub(n) {
        this.index -= n
        this.col -= n
        return this
    }
    
    toString() {
        return `${this.lineno}:${this.col}`
    }
}