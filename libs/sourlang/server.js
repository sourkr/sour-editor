import Validator, { FunctionScope } from "./parser/validator.js";
import { Scope } from "./parser/scope.js";

const KEWWORD_STMT = new Set(["if", "for", "export", "import", "new"]);
const DEF_STMT = new Set(["func-dec", "var-dec"]);

const GLOBAL_KEYWORDS = [
    "func",
    "if",
    "else",
    "for",
    "var",
    "export",
    "import",
    "new",
];

const PAIRS = {
    "(": ")",
    "{": "}",
    "[": "]",
    '"': '"',
    "'": "'",
    "<": ">",
};

export default class Server {
    #modules = new Map()
    
    #file
    
    constructor(file) {
        this.#file = file;
    }

    // Linting
    lint(span) {
        this.span = span;

        const validator = new Validator(span.text, this.#file.parent);
        
        this.#modules.forEach((def, name) => validator.add_module(name, def))
        
        const prog = validator.validate();

        this.prog = prog;
        this.globals = new Scope(validator.globals);

        prog.ast.forEach((stmt) => this.lint_expr(stmt, 0));

        prog.errors.forEach((err) => {
            span.error(err.start?.index, err.end?.index);
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

        if (expr.type == "export") {
            this.lint_expr(expr.def, depth);
        }

        if (expr.type == "import") {
            this.lint_token(expr.from, "tok-kw");
            this.lint_expr(expr.path);
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
            this.lint_expr(expr.val, depth);
        }

        if (expr.type == "func-call") {
            if (expr.access.type == 'ident') {
                this.lint_token(expr.access, "tok-func-call");
            } else if (expr.access.type == 'dot') {
                this.lint_expr(expr.access.left)
                this.lint_token(expr.access.right, "tok-func-call")
            }
            
            this.lint_bracket(expr.args, depth);
            this.lint_list(expr.args, depth + 1);
            return;
        }

        if (expr.type == "new") {
            this.lint_token(expr.name, "tok-type");

            if (expr.generic) {
                this.lint_bracket(expr.generic, depth, "op");
                expr.generic.list.forEach((type) => this.lint_type(type));
            }

            this.lint_bracket(expr.args, depth);
            this.lint_list(expr.args, depth + 1);
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

        if (expr.type == "index") {
            this.lint_expr(expr.access);
            this.lint_bracket(expr, depth);
            this.lint_expr(expr.expr);
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

    lint_bracket(expr, depth, tokType = "punc") {
        if (
            expr.endTok?.type !== tokType ||
            expr.endTok.value !== PAIRS[expr.endTok.value]
        ) {
            if (expr.startTok.value == "(") this.match("(", ")");
            if (expr.startTok.value == "{") this.match("{", "}");
            if (expr.startTok.value == "[") this.match("[", "]");
            if (expr.startTok.value == "<") this.match("<", ">");
        }

        if (!expr.endTok) return;

        const colors = [`tok-bracket-depth-${depth % 3}`];

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
        return this.list_body(this.prog.ast, this.globals, GLOBAL_KEYWORDS);
    }

    list_body(body, scope, keywords) {
        for (let stmt of body) {
            const list = this.list(stmt, scope, keywords);
            if (list?.length) return list;
        }
    }

    list(stmt, scope, keywords = []) {
        let list;

        if (stmt.type == "export") {
            return this.list(stmt.def, scope);
        }

        if (stmt.type == "import") {
            if (this.#touching(stmt.from)) {
                if ("from".startsWith(stmt.from.value)) {
                    return [
                        { type: "kw", prefix: stmt.from.value, name: "from" },
                    ];
                }
            }

            if (this.#touching(stmt.path)) {
                const prefix = stmt.path.value
                const list = []
                
                const files = this.#file.parent.list
                    .filter((file) => file.endsWith(".sour"))
                    .filter(file => file != this.#file.name)
                    .map((file) => file.slice(0, -5))
                    .filter((file) => file.startsWith(prefix))
                    .forEach((file) => list.push({ type: "file", prefix, name: file }));
                    
                const modules = this.#modules.keys()
                    .filter(name => name.startsWith(prefix))
                    .forEach(name => list.push({ type: 'file', prefix, name }))
                
                return list
            }
        }

        if (stmt.type == "func-dec") {
            const funcScope = new Scope(scope);

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
            console.log(scope);
            scope.def_var(stmt.name.value, stmt.doc);
            return this.list(stmt.val, scope, ["new"]);
        }

        if (stmt.type == "func-call") {
            list = this.list_body(stmt.args.list, scope);
            if (list?.length) return list;
        }

        if (stmt.type == "new") {
            list = this.list(stmt.name, scope);
            if (list?.length) return list;

            if (stmt.generic) {
                for (let typeName of stmt.generic.list) {
                    list = this.list_type(typeName, scope);
                    if (list?.length) return list;
                }
            }
        }

        if (stmt.type == "op") {
            list = this.list(stmt.left, scope);
            if (list?.length) return list;

            list = this.list(stmt.right, scope);
            if (list?.length) return list;
        }

        if (stmt.type == "dot") {
            list = this.list(stmt.left, scope);
            if (list?.length) return list;

            if (this.#touching(stmt.right)) {
                list = [];
                const prefix = stmt.right.value;

                // console.log(stmt.left.doc.cls.scope.get_all_props().toArray)

                stmt.left.doc.cls.scope
                    .get_all_props()
                    .filter((prop) => prop.prop_name.startsWith(prefix))
                    .forEach((prop) =>
                        list.push({
                            type: "var",
                            prefix,
                            name: prop.prop_name,
                            doc: prop,
                        }),
                    );

                stmt.left.doc.cls.scope
                    .get_all_meths()
                    .filter((meth) => meth.name.startsWith(prefix))
                    .map(meth => {
                        if (stmt.left.doc.generic) {
                            return {
                                ...meth,
                                params: meth.params.map((param, i) => {
                                    return {
                                        ...param,
                                        type: stmt.left.doc.generic[i]
                                    }
                                })
                            }
                        } else {
                            return meth
                        }
                    })
                    .forEach((meth) =>
                        list.push({
                            type: "func",
                            prefix,
                            name: meth.name,
                            doc: meth,
                        }),
                    );

                return list;
            }
        }

        if (stmt.type == "index") {
            return this.list(stmt.access, scope) || this.list(stmt.expr, scope);
        }

        if (stmt.type == "ident") {
            if (this.#touching(stmt, true)) {
                const prefix = stmt.value;

                const kws = keywords
                    .filter((kw) => kw.startsWith(prefix))
                    .map((kw) => {
                        return { type: "kw", prefix, name: kw };
                    });

                console.log(scope.get_all_vars().toArray());
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

                // console.log(scope.get_all_class().toArray())

                const classes = scope
                    .get_all_class()
                    .filter((cls) => !cls.is_type)
                    .filter((cls) => cls.name.startsWith(prefix))
                    .map((cls) => {
                        return {
                            type: "class",
                            prefix,
                            name: cls.name,
                            doc: cls,
                        };
                    });

                return [...kws, ...vars, ...funcs, ...classes];
            }
        }
    }

    list_type(type, scope, allowVoid) {
        if (type.type == "simple") {
            if (!this.#touching(type.name, true)) return;

            const types = [];
            const prefix = type.name.value;

            scope
                .get_all_class()
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
        if (!node) return;

        let doc;

        if (node.type == "export") {
            return this.doc_node(node.def);
        }

        if (node.type == "func-dec") {
            if (this.#touching(node.name)) return node.doc;

            for (let param of node.params.list) {
                if (this.#touching(param.name)) return param.doc;
                let doc = this.doc_type(param.type);
                if (doc) return doc;
            }

            doc = this.doc_type(node.retType);
            if (doc) return doc;

            return this.doc_list(node.body);
        }

        if (node.type == "var-dec") {
            if (this.#touching(node.name)) return node.doc;
            return this.doc_node(node.val);
        }

        if (node.type == "if") {
            return (
                this.doc_node(node.cond) ||
                this.doc_list(node.body) ||
                this.doc_list(node.elseStmt?.body)
            );
        }

        if (node.type == "for") {
            return (
                this.doc_node(node.init) ||
                this.doc_node(node.cond) ||
                this.doc_node(node.inc) ||
                this.doc_list(node.body)
            );
        }

        if (node.type == "func-call") {
            if (this.#touching(node.name)) return node.doc;
            return this.doc_list(node.args);
        }

        if (node.type == "new") {
            if (this.#touching(node.name)) return node.doc;

            if (node.generic) {
                for (let type of node.generic.list) {
                    let doc = this.doc_type(type);
                    if (doc) return doc;
                }
            }
        }

        if (node.type == "op") {
            return this.doc_node(node.left) || this.doc_node(node.right);
        }

        if (node.type == "unary") {
            return this.doc_node(node.expr);
        }

        if (node.type == "dot") {
            return this.doc_node(node.left) || this.doc_node(node.right);
        }

        if (node.type == "index") {
            return this.doc_node(node.access) || this.doc_node(node.expr);
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
    }
    
    // Utils
    add_module(name, def) {
        this.#modules.set(name, def)
    }
}

function empty(a) {
    return !!a?.length;
}
