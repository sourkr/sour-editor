import { BaseParser } from './base.js'

export default class DefinationParser extends BaseParser {
    globals = new BuiltinScope()
    
    file() {
        const kw = this.next('kw', 'func')
        const doc = this.lastComment
        this.lastComment = null
        
        const name = this.next('ident')
        const params = this.list('(,)', this.param)
        const colon = this.next('punc', ':')
        const retType = this.type()
        
        this.globals.def_func({
            type: 'func',
            name: name.value,
            params: params.list.map(p => { return { type: { type: p.type.type, name: p.type.name.value }, name: p.name.value } }),
            retType: this.toType(retType),
            doc: doc.value.slice(1).trim()
        })
        
        return { type: 'func-def', kw, doc, name, params, colon, retType }
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
    
    toType(type) {
        if (type.type === 'simple') {
            return { type: 'simple', name: type.name.value }
        }
    }
}


class BuiltinScope {
    #funcs = []
    
    def_func(func) {
        this.#funcs.push(func)
    }
    
    has_func(name) {
        return this.get_all_funcs()
            .some(func => func.name === name)
    }
    
    get_funcs(name) {
        return this.get_all_funcs()
            .filter(func => func.name === name)
    }
    
    get_all_funcs() {
        return this.#funcs
    }
}