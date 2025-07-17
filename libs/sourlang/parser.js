import { BaseParser } from './base.js'

export default class Parser extends BaseParser {
    file() {
        if (this.is("kw", "print")) {
            const kw = this.next()
            const expr = this.expr()
            return { type: 'print', kw, expr } 
        }
        
        if (this.is("kw", "func")) {
            const kw = this.next()
            const name = this.next('ident')
            const params = this.list('(,)', this.param)
            const colon = this.next('punc', ':')
            const retType = this.type()
            
            return { type: 'func-def', kw, name, params, colon, retType }
        }
        
        if (this.is('ident')) {
            const name = this.next()
            const args = this.list("(,)", this.expr)
            
            return { type: 'func-call', name, args }
        }
        
        return super.file()
    }
    
    expr(isStmt) {
        if (this.is("int") || this.is("str") || this.is("char")) return this.next()
        
        return super.file()
    }
    
    ident(ident) {
        
    }
    
    param() {
        const name = this.next('ident')
        const colon = this.next('punc', ':')
        const type = this.type()
        
        return { name, colon, type }
    }
    
    type() {
        const name = this.next('ident')
        return { type: 'simple', name }
    }
    
    list(cond, parse) {
        if (cond.length == 3) {
            const list = []
            const sep = []
            
            const startTok = this.next('punc', cond[0])
            
            if (this.hasError()) return { startTok, list, sep }
            
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
               
               if (this.hasError()) return { startTok, list, sep }
               
               sep.push(this.next('punc', cond[1]))
            }
        }
    }
}