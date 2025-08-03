import { BaseParser } from "./base.js";

export default class Parser extends BaseParser {
    node(node_type) {
        if (node_type === "file") {
            if (this.is("kw", "import")) {
                const kw = this.next();
                const star = this.next("op", "*");
                const from = this.next("kw", "from");
                const path = this.next("str");

                return { type: "import", kw, star, from, path };
            }

            if (this.is("kw", "export")) {
                const kw = this.next();
                const def = this.def();

                return { type: "export", kw, def };
            }


            if (this.is("kw", "class")) {
                const kw = this.next()
                const name = this.next("ident")
                const body = this.list("{}", this.def)

                return { type: "class-dec", kw, name, body }
            }

            return this.node("def")
        }

        if (node_type === "def") {
            return this.def()
        }

        if (node_type === "stmt") {
            return this.stmt()
        }

        if (node_type === "expr") {
            return this.expr()
        }
    }
    
    file() {
        return this.node("file")
    }

    def(node_type = "def") {
        // if (node_type == "file") {}

        // if (node_type == "def") {}

        // if (node_type == "stmt") {}

        if (node_type !== "stmt") {
            if (this.is("kw", "func")) {
                const doc = this.lastComment?.value;
                this.lastComment = null;
                const kw = this.next();
                const name = this.next("ident");
                const params = this.list("(,)", this.param);
                const colon = this.next("punc", ":");
                const retType = this.type();
                const body = this.list("{}", this.stmt);

                return { type: "func-dec", kw, name, params, colon, retType, body, doc }
            }
        }

        return this.stmt(node_type);
    }

    var() {
        const kw = this.next("kw", "var")
        const name = this.next("ident")

        if (this.is("punc", ":")) {
            this.skip()
            const var_type = this.type()
            return { type: "var-def", kw, name, var_type }
        }

        const eq = this.next("op", "=")
        const val = this.expr()

        return { type: "var-dec", kw, name, eq, val }
    }

    stmt(node_type = "stmt") {
        // if (node_type == "file") {}
        
        // if (node_type == "def") {}

        if (node_type === "stmt") {
            if (this.is("kw", "if")) {
                const kw = this.next();
                const startTok = this.next("punc", "(");
                const cond = this.scope(this.expr);
                const endTok = this.next("punc", ")");
                const body = this.list("{}", this.stmt);

                let elseStmt;

                if (this.is("kw", "else")) {
                    const kw = this.next();
                    const body = this.list("{}", this.stmt);

                    elseStmt = { kw, body };
                }

                return { type: "if", kw, startTok, cond, endTok, body, elseStmt };
            }

            if (this.is("kw", "for")) {
                const kw = this.next();
                const startTok = this.next("punc", "(");
                const init = this.stmt();
                this.next("punc", ";");
                const cond = this.scope(this.expr);
                this.next("punc", ";");
                const inc = this.expr();
                const endTok = this.next("punc", ")");
                const body = this.list("{}", this.stmt);

                return { type: "for", kw, startTok, init, cond, inc, endTok, body };
            }

            if (this.is("kw", "return")) {
                const kw = this.next()
                const value = this.expr()

                return { type: "ret", kw, value }
            }
        }

        if (this.is("kw", "var")) return this.var()

        return this.expr(true);
    }


    expr(is_stmt) {
        if (!is_stmt) {
            if (this.is("kw", "new")) {
                const kw = this.next();
                const name = this.next("ident");

                let generic
                
                if (this.is('op', '<')) {
                    generic = this.list('<,>', this.type, "op")
                }

                const args = this.list("(,)", this.expr)

                return { type: 'new', kw, name, generic, args }
            }
            
            if (this.is("num") || this.is("str") || this.is("char")) {
                return this.mayop(this.next());
            }
        }
        if (this.is("ident")) {
            return this.access(this.next(), is_stmt)
        }


        return super.file();
    }

    mayop(expr, is_stmt) {
        if (this.is("op")) {
            const op = this.next();

            if (op.value === "+" && this.is("op", "+")) {
                this.next();
                return { type: "unary", expr, op: "++" };
            }

            if (op.value == "=" && this.is("op", "=")) {
                this.skip()
                const right = this.node("expr")
                return { type: "op2", left: expr, right, op: "==" }
            }
            
            if (!is_stmt) {
                const right = this.expr();
                return { type: "op", left: expr, right, op };
            }
        }

        if (!is_stmt) return expr;

        this.error("not a valid statment", expr)
        return expr
    }

    access(access, is_stmt) {
        if (this.is("punc", "(")) {
            const args = this.list("(,)", this.expr);
            return { type: "func-call", access, args };
        }

        if (this.is("op", "=")) {
            this.skip()

            if (this.is("op", "=")) {
                this.skip()
                const right = this.node("expr")
                return { type: "op2", left: access, right, op: "==" }
            }

            const value = this.expr()
            return { type: "assign", access, value }
        }
        
        if (this.is("punc", "[")) {
            const startTok = this.next();
            const expr = this.expr();
            const endTok = this.next("punc", "]");

            return this.access({ type: "index", access, expr, startTok, endTok });
        }

        if (this.is("punc", ".")) {
            this.skip();
            const right = this.next("ident");

            return this.access({ type: "dot", left: access, right });
        }

        return this.mayop(access, is_stmt);
    }

    unexpected(token) {
        // console.log({token})
        this.error(`ParseError: Unexpected token '${token.value}'`, token);
        return token;
    }

    param() {
        const name = this.next("ident");
        const colon = this.next("punc", ":");
        const type = this.type();

        return { name, colon, type };
    }

    type() {
        const name = this.next("ident");
        return { type: "simple", name };
    }

    list(cond, parse, tokType = "punc") {
        if (cond.length == 3) {
            const list = [];
            const sep = [];

            const startTok = this.next(tokType, cond[0]);

            if (this.hasError()) return { startTok, list, sep };

            if (this.is(tokType, cond[2])) {
                const endTok = this.next();
                return { startTok, list, sep, endTok };
            }

            while (this.has) {
                list.push(parse.call(this));

                if (this.is(tokType, cond[2])) {
                    const endTok = this.next();
                    return { startTok, list, sep, endTok };
                }

                if (this.hasError()) return { startTok, list, sep };

                sep.push(this.next("punc", cond[1]));
            }
        }

        if (cond.length == 2) {
            const list = [];

            const startTok = this.next("punc", cond[0]);

            if (this.hasError()) return { startTok, list };

            while (this.has) {
                if (this.is("punc", cond[2])) {
                    const endTok = this.next();
                    return { startTok, list, endTok };
                }

                list.push(parse.call(this));

                if (this.hasError()) return { startTok, list };
            }
        }
    }
}
