import Parser from "./parser.js"

export default class Interpreter {
    #parser
    
    inputStream = new Stream()
    errorStream = new Stream()
    outputStream = new Stream()
    
    #outstream = this.inputStream
    #errstream = this.errorStream
    #inpstream = this.outputStream
    
    constructor(input, filepath) {
        this.#parser = new Parser(input, filepath)
    }
    
    interprete() {
        const prog = this.#parser.parse()
        
        if (prog.errors.length) {
            prog.errors.forEach(err => this.#errstream.write(err.toString()))
            return
        }
        
        this.#interpreteBody(prog.ast, () => {
            this.#inpstream.close()
            this.#errstream.close()
            this.#outstream.close()
        }, err => {
            this.#errstream.write(err.toString())
            
            this.#inpstream.close()
            this.#errstream.close()
            this.#outstream.close()
        })
    }
    
    #interpreteBody(body, resolve, reject, index = 0) {
        if (index >= body.length) {
            resolve()
            return
        }
        
        this.#interprete(body[index], () => {
            this.#interpreteBody(body, resolve, reject, index+1)
        }, reject)
    }
    
    #interprete(expr, resolve, reject) {
        if (!expr) return
        
        if (expr.type === 'func-call') {
            if (expr.name.value === '_stdout') {
                this.#interprete(expr.args.list[0], char => {
                    this.#outstream.write(String.fromCharCode(char))
                    resolve()
                }, reject)
                
                return
            }
            
            if (expr.name.value === '_stderr') {
                this.#interprete(expr.args.list[0], char => {
                    this.#errstream.write(String.fromCharCode(char))
                    resolve()
                }, reject)
                
                return
            }
            
            if (expr.name.value === '_stdin') {
                this.#inpstream.read().then(char => resolve(char.charCodeAt(0)))
            }
            
            return
        }
        
        if (expr.type === 'print') {
            this.#interprete(expr.expr, str => {
                this.#outstream.write(str)
                resolve()
            }, reject)
            return
        }
        
        if (expr.type === 'str') {
            resolve(expr.value)
            return
        }
        
        if (expr.type === 'char') {
            resolve(expr.value.charCodeAt(0))
            return
        }
    }
}

class Stream {
    #buffer = []
    #reader
    #closed = false
    #onclose
    
    read() {
        return new Promise((resolve, reject) => {
            if (this.#buffer.length) {
                resolve(this.#buffer.shift())
                return
            }
            
            if (this.#closed) {
                reject(new Error('Stream is closed'))
                return
            }
            
            this.#reader = data => {
                resolve(data)
                this.#onclose = null
                this.#reader = null
            }
            
            this.#onclose = () => {
                reject(new Error('Stream is closed'))
                this.#onclose = null
                this.#reader = null
            }
        })
    }
    
    write(data) {
        if (this.#closed) throw new Error('Stream is closed')
        
        if (this.#reader) this.#reader(data)
        else this.#buffer.push(data)
    }
    
    close() {
        this.#closed = true
        this.#onclose?.()
    }
    
    [Symbol.dispose]() {
        this.close()
    }
}
