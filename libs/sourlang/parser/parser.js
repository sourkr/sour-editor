import { BaseParser } from "./base.js";

export default class Parser extends BaseParser {
    file() {
        if (this.is("kw", "export")) {
            const kw = this.next();
            const def = this.def();

            return { type: "export", kw, def };
        }

        if (this.is("kw", "import")) {
            const kw = this.next();
            const star = this.next("op", "*");
            const from = this.next("kw", "from");
            // console.log(this.peek())
            const path = this.next("str");

            return { type: "import", kw, star, from, path };
        }

        return this.def();
    }

    stmt() {
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

        if (this.is("kw", "var")) {
            const kw = this.next();
            const name = this.next("ident");
            const eq = this.next("op", "=");
            const val = this.expr();

            return { type: "var-dec", kw, name, eq, val };
        }

        return this.expr(true);
    }

    def() {
        if (this.is("kw", "func")) {
            const doc = this.lastComment?.value;
            this.lastComment = null;
            const kw = this.next();
            const name = this.next("ident");
            const params = this.list("(,)", this.param);
            const colon = this.next("punc", ":");
            const retType = this.type();
            const body = this.list("{}", this.stmt);

            return {
                type: "func-dec",
                kw,
                name,
                params,
                colon,
                retType,
                body,
                doc,
            };
        }

        return this.stmt();
    }

    expr(isStmt) {
        if (this.is("ident")) {
            return this.access(this.maydot(this.next()), isStmt);
        }

        if (!isStmt) {
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

        return super.file();
    }

    mayop(expr, is_stmt) {
        if (this.is("op")) {
            const op = this.next();

            if (op.value === "+" && this.is("op", "+")) {
                this.next();
                return { type: "unary", expr, op: "++" };
            }

            if (!is_stmt) {
                const right = this.expr();
                return { type: "op", left: expr, right, op };
            }
        }

        if (!is_stmt) return expr;
        return this.unexpected(expr);
    }

    maydot(access) {
        if (this.is("punc", ".")) {
            this.skip();
            const right = this.next("ident");

            return { type: "dot", left: access, right };
        }

        return this.mayindex(access);
    }

    access(access, is_stmt) {
        if (this.is("punc", "(")) {
            const args = this.list("(,)", this.expr);
            return { type: "func-call", access, args };
        }

        return this.mayop(access, is_stmt);
    }

    mayindex(access) {
        if (this.is("punc", "[")) {
            const startTok = this.next();
            const expr = this.expr();
            const endTok = this.next("punc", "]");

            return { type: "index", access, expr, startTok, endTok };
        }

        return access;
    }

    unexpected(token) {
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
