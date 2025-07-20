import Validator, { FunctionScope } from "./parser/validator.js";

const KEWWORD_STMT = new Set(["if", "for"]);
const DEF_STMT = new Set(["func-dec", "var-dec"]);

const GLOBAL_KEYWORDS = ["func", "if", "else", "for", "var"];

export default class Server {
    // Linting
    lint(span) {
        this.span = span;

        const validator = new Validator(span.text);
        const prog = validator.validate();

        this.prog = prog;
        this.globals = validator.globals;

        prog.ast.forEach((stmt) => this.lint_expr(stmt, 0));

        prog.errors.forEach((err) => {
            span.error(err.start.index, err.end.index);
        });
    }

    lint_list(list, depth) {
        list.list.forEach((expr) => this.lint_expr(expr, depth));
    }

    lint_expr(expr, depth) {
        if (!expr) return;

        if (KEWWORD_STMT.has(expr.type)) {
            this.lint_token(expr.kw, "tok-kw");
        }

        if (DEF_STMT.has(expr.type)) {
            this.lint_token(expr.kw, "tok-def");
        }

        if (expr.type == "func-dec") {
            this.lint_token(
                expr.name,
                expr.doc?.is_used ? "tok-func-call" : "tok-func-call dim",
            );

            this.lint_bracket(expr.params, depth);

            expr.params.list.forEach((param) => {
                this.lint_token(
                    param.name,
                    param.doc.is_used ? "tok-var" : "tok-var dim",
                );
                this.lint_type(param.type);
            });

            this.lint_type(expr.retType);
            this.lint_bracket(expr.body, depth);
            this.lint_list(expr.body, depth + 1);

            return;
        }

        if (expr.type === "if") {
            this.lint_bracket(expr, depth);
            this.lint_expr(expr.cond);
            this.lint_bracket(expr.body, depth);
            this.lint_list(expr.body, depth + 1);

            if (expr.elseStmt) {
                this.lint_token(expr.elseStmt.kw, "tok-kw");
                this.lint_bracket(expr.elseStmt.body, depth);
                this.lint_list(expr.elseStmt.body, depth + 1);
            }
        }

        if (expr.type === "for") {
            this.lint_bracket(expr, depth, depth);
            this.lint_expr(expr.init);
            this.lint_expr(expr.cond);
            this.lint_expr(expr.inc);
            this.lint_bracket(expr.body, depth);
            this.lint_list(expr.body, depth + 1);
        }

        if (expr.type === "var-dec") {
            this.lint_token(
                expr.name,
                expr.doc?.is_used ? "tok-var" : "tok-var dim",
            );
            this.lint_expr(expr.val);
        }

        if (expr.type == "func-call") {
            this.lint_token(expr.name, "tok-func-call");
            this.lint_bracket(expr.args, depth);
            this.lint_list(expr.args, depth + 1);
            return;
        }

        if (expr.type == "op") {
            this.lint_expr(expr.left);
            this.lint_expr(expr.right);
            return;
        }

        if (expr.type == "unary") {
            this.lint_expr(expr.expr);
            return;
        }

        if (expr.type == "dot") {
            this.lint_expr(expr.left);
            this.lint_token(expr.right, "tok-var");
            return;
        }

        if (expr.type == "char") {
            if (expr.unmatched) this.match("'", "'");
            this.lint_token(expr, "tok-char");
            return;
        }

        if (expr.type == "str") {
            if (expr.unmatched) this.match('"', '"');
            this.lint_token(expr, "tok-str");
            return;
        }

        if (expr.type == "ident") {
            this.lint_token(expr, "tok-var");
            return;
        }

        if (expr.type == "num") {
            this.lint_token(expr, "tok-num");
            return;
        }
    }

    lint_type(type) {
        if (type.type == "simple") {
            this.lint_token(type.name, "tok-type");
        }
    }

    lint_token(token, color) {
        this.span.color(token.start.index, token.end.index, color);
    }

    lint_bracket(expr, depth) {
        if (expr.endTok?.type !== "punc") {
            if (expr.startTok.value == "(") this.match("(", ")");
            if (expr.startTok.value == "{") this.match("{", "}");
            return;
        }

        const colors = [`tok-bracket-depth-${depth}`];

        if (this.#touching(expr.startTok) || this.#touching(expr.endTok)) {
            colors.push("tok-bracket-lit");
        }

        const color = colors.join(" ");

        this.lint_token(expr.startTok, color);
        this.lint_token(expr.endTok, color);
    }

    #touching(token, end) {
        if (!token) return false;
        if (!token.start) return false;
        
        if (end) {
            return this.cursorIndex === token.end.index;
        }

        return (
            this.cursorIndex >= token.start.index &&
            this.cursorIndex <= token.end.index
        );
    }

    // Error Tooltip
    error() {
        for (let err of this.prog.errors) {
            if (this.#touching(err)) {
                return err.message;
            }
        }

        return null;
    }

    // Code Completions
    completions() {
        return this.list_body(this.prog.ast, this.globals);
    }

    list_body(body, scope) {
        for (let stmt of body) {
            const list = this.list(stmt, scope);
            if (list?.length) return list;
        }
    }

    list(stmt, scope) {
        let list;

        if (stmt.type == "func-dec") {
            const funcScope = new FunctionScope(scope);

            for (let param of stmt.params.list) {
                const list = this.list_type(param?.type, scope);
                funcScope.def_var(param.name.value, param.doc);
                if (list?.length) return list;
            }

            let list = this.list_type(stmt.retType, scope, true);
            if (list?.length) return list;

            list = this.list_body(stmt.body.list, funcScope);
            if (list?.length) return list;
        }

        if (stmt.type == "if") {
            list = this.list(stmt.cond, scope);
            if (list?.length) return list;

            list = this.list_body(stmt.body.list, scope);
            if (list?.length) return list;

            if (stmt.elseStmt) {
                list = this.list_body(stmt.elseStmt.body.list, scope);
                if (list?.length) return list;
            }
        }

        if (stmt.type == "for") {
            list = this.list(stmt.init, scope);
            if (list?.length) return list;

            list = this.list(stmt.cond, scope);
            if (list?.length) return list;

            list = this.list(stmt.inc, scope);
            if (list?.length) return list;

            list = this.list_body(stmt.body.list, scope);
            if (list?.length) return list;
        }

        if (stmt.type === "var-dec") {
            scope.def_var(stmt.name.value, stmt.doc);

            list = this.list(stmt.val, scope);
            if (list?.length) return list;
        }

        if (stmt.type == "func-call") {
            list = this.list_body(stmt.args.list, scope);
            if (list?.length) return list;
        }

        if (stmt.type == "op") {
            list = this.list(stmt.left, scope);
            if (list?.length) return list;

            list = this.list(stmt.right, scope);
            if (list?.length) return list;
        }

        if (stmt.type == "dot") {
            this.list(stmt.left, scope);
            if (list?.length) return list;

            if (this.#touching(stmt.right)) {
                list = []
                const prefix = stmt.right.value
                // console.log(stmt.left.doc.scope.get_all_props().toArray())
                stmt.left.doc.scope.get_all_props()
                    .filter(prop => prop.prop_name.startsWith(prefix))
                    .forEach(prop => list.push({
                        type: 'var',
                        prefix,
                        name: prop.prop_name,
                        doc: prop
                    }))
                return list
            }
        }

        if (stmt.type == "ident") {
            if (this.#touching(stmt, true)) {
                const prefix = stmt.value;

                const keywords = GLOBAL_KEYWORDS.filter((kw) =>
                    kw.startsWith(prefix),
                ).map((kw) => {
                    return { type: "kw", prefix, name: kw };
                });

                const vars = scope
                    .get_all_vars()
                    .filter((e) => e.name.startsWith(prefix))
                    .map((v) => {
                        return {
                            type: "var",
                            prefix,
                            name: v.name,
                            doc: v.type,
                        };
                    });

                console.log(scope.get_all_funcs().toArray());

                const funcs = scope
                    .get_all_funcs()
                    .filter((func) => func.name.startsWith(prefix))
                    .map((func) => {
                        return {
                            type: "func",
                            prefix,
                            name: func.name,
                            doc: func,
                        };
                    });

                return [...keywords, ...vars, ...funcs];
            }
        }
    }

    list_type(type, scope, allowVoid) {
        if (type.type == "simple") {
            if (!this.#touching(type.name, true)) return;

            const types = [];
            const prefix = type.name.value

            console.log(scope)
            scope.get_all_classes()
                .filter((cls) => cls.name.startsWith(prefix))
                .forEach((cls) =>
                    types.push({
                        type: cls.is_type ? "type" : "class",
                        name: cls.name,
                        prefix,
                        doc: cls,
                    }),
                );

            if (allowVoid && "void".startsWith(prefix)) {
                types.push({
                    type: "type",
                    name: "void",
                    prefix,
                });
            }

            return types;
        }
    }

    doc() {
        for (let node of this.prog.ast) {
            const doc = this.doc_node(node);
            if (doc) return doc;
        }
    }

    doc_node(node) {
        if(!node) return;
        
        let doc
        
        if (node.type == "func-dec") {
            if (this.#touching(node.name)) return node.doc;
            
            for(let param of node.params.list) {
                if (this.#touching(param.name)) return param.doc;
                let doc = this.doc_type(param.type);
                if (doc) return doc;

            }

            doc = this.doc_type(node.retType);
            if (doc) return doc;

            return this.doc_list(node.body)
        }

        if (node.type == "var-dec") {
            if (this.#touching(node.name)) return node.doc;
            return this.doc_node(node.val)
        }

        if (node.type == "if") {
            return this.doc_node(node.cond)
                || this.doc_list(node.body)
                || this.doc_list(node.elseStmt?.body)
        }

        if (node.type == "func-call") {
            if (this.#touching(node.name)) return node.doc;
            return this.doc_list(node.args);
        }

        if (node.type == "op") {
            return this.doc_node(node.left)
                || this.doc_node(node.right)
        }

        if (node.type == "unary") {
            return this.doc_node(node.expr)
        }

        if (node.type == "dot") {
            return this.doc_node(node.left)
                || this.doc_node(node.right)
        }
        
        if (node.doc && this.#touching(node)) {
            return node.doc;
        }
    }

    doc_list(list) {
        if (!list) return;
        
        for (let node of list.list) {
            const doc = this.doc_node(node);
            if (doc) return doc;
        }
    }

    doc_type(type) {
        if (type.type == "simple") {
            if (this.#touching(type.name)) return type.doc;
        }

        if (type.type == "class") {
            if (this.#touching(type.name)) return type.doc;;
        }
    }
}

function empty(a) {
    return !!a?.length;
}
