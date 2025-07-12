import { BaseParser } from './base.js'

export default class Parser extends BaseParser {
    file() {
        if (this.is("kw", "print")) {
            const kw = this.next()
            const expr = this.expr()
            return { type: 'print', kw, expr } 
        }
        
        if (this.is('ident', '_stdout')) {
            const name = this.next()
            const args = this.list("(,)", this.expr)
            
            return { type: 'func-call', name, args }
        }
        
        return super.file()
    }
    
    expr(isStmt) {
        if (this.is("int") || this.is("str") || this.is("char")) return this.next()
    }
    
    list(cond, parse) {
        if (cond.length == 3) {
            const list = []
            const sep = []
            
            const startTok = this.next('punc', cond[0])
            
            if (this.is('punc', cond[2])) {
                const endTok = this.next()
                return { startTok, list, sep, endTok }
            }
            
            while(this.has) {
               list.push(parse.call(this))
               
               if (this.is('punc', cond[2])) {
                   const endTok = this.next()
                   return { startTok, list, sep, endTok }
               }
               
               sep.push(this.next('punc', cond[1]))
            }
        }
    }
}