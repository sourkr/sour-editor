import { BaseParser } from './base.js'

export default class Parser extends BaseParser {
    file() {
        // console.log(this.peek())
        
        if (this.is("kw", "print")) {
            const kw = this.next()
            const expr = this.expr()
            return { type: 'print', kw, expr } 
        }
        
        return super.file()
    }
    
    expr(isStmt) {
        return this.next('str')
    }
}