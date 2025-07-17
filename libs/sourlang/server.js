import Validator from "./validator.js"

export default class Server {
    // Linting
    lint(span) {
        this.span = span
        
        const validator = new Validator(span.text)
        const prog = validator.validate()
        
        this.prog = prog
        
        prog.ast.forEach(stmt => {
            if (stmt.type == 'func-call') {
                this.lint_token(stmt.name, 'tok-func-call')
                this.lint_bracket(stmt.args, 0)
                this.lint_list(stmt.args)
                return
            }
        })
        
        prog.errors.forEach(err => {
            span.error(err.start.index, err.end.index)
        })
    }
    
    lint_list(list) {
        list.list.forEach(expr => this.lint_expr(expr))
    }
    
    lint_expr(expr) {
        if (!expr) return
        
        if (expr.type == 'char') {
            if (expr.unmatched) this.match("'", "'")
            this.lint_token(expr, 'tok-char')
        }
    }
    
    lint_token(token, color) {
        this.span.color(token.start.index, token.end.index, color)
    }
    
    lint_bracket(expr, depth) {
        if (!expr.endTok) {
            this.match('(', ')')
            return
        }
        
        const colors = [`tok-bracket-depth-${depth}`]
        
        if (this.#touching(expr.startTok) || this.#touching(expr.endTok)) {
            colors.push('tok-bracket-lit')
        }
        
        const color = colors.join(' ')
        
        this.lint_token(expr.startTok, color)
        this.lint_token(expr.endTok, color)
    }
    
    #touching(token) {
        return this.cursorIndex >= token.start.index && this.cursorIndex <= token.end.index
    }
    
    // Error Tooltip
    error() {
        for(let err of this.prog.errors) {
            if (this.#touching(err)) {
                return err.message
            }
        }
        
        return null
    }
    
    // Code Completions
    completions() {
        
    }
}