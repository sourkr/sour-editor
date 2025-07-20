import Validator from "../parser/validator.js";
import { InstanceScope } from "./scope.js"
import BUILTINS, { to_byte, to_char, to_str } from "./builtin.js";

export default class Interpreter {
    #validator;

    inputStream = new Stream();
    errorStream = new Stream();
    outputStream = new Stream();

    #outstream = this.inputStream;
    #errstream = this.errorStream;
    #inpstream = this.outputStream;

    globals = new GlobalScope(BUILTINS);

    constructor(input, filepath) {
        this.#validator = new Validator(input, filepath);
    }

    interprete() {
        const prog = this.#validator.validate();

        if (prog.errors.length) {
            prog.errors.forEach((err) => this.#errstream.write(err.toString()));
            return;
        }

        console.log(prog.ast)
        
        this.globals.def_func("_stdout__char", (args, prog) => {
            this.#outstream.write(String.fromCharCode(args[0].value));
            prog.resolve();
        });

        this.globals.def_func("_stderr__char", (args, prog) => {
            this.#errstream.write(String.fromCharCode(args[0].value));
            prog.resolve();
        });

        this.globals.def_func("_stdin__", (_args, prog) => {
            this.#inpstream.read()
                .then((char) => prog.resolve(to_char(char.charCodeAt(0))));
        });

        this.#interpreteBody(prog.ast, this.globals, {
            resolve: () => {
                this.#inpstream.close();
                this.#errstream.close();
                this.#outstream.close();
            },

            reject: (err) => {
                this.#errstream.write(err.toString());

                this.#inpstream.close();
                this.#errstream.close();
                this.#outstream.close();
            },
        });
    }

    #interpreteBody(body, scope, prog, index = 0, res = []) {
        if (index >= body.length) {
            prog.resolve(res);
            return;
        }

        this.#interprete(body[index], scope, {
            ...prog,
            resolve: (val) => {
                res.push(val);
                this.#interpreteBody(body, scope, prog, index + 1, res);
            },
        });
    }

    #interprete(expr, scope, prog) {
        if (!expr) return;

        // const $this = this;

        if (expr.type == "func-dec") {
            scope.def_func(expr.alias, (args, prog) => {
                const funcScope = new FunctionScope(scope);
                expr.params.list.forEach((param, i) =>
                    funcScope.def_var(param.name.value, args[i]),
                );

                this.#interpreteBody(expr.body.list, funcScope, {
                    ...prog,
                    return: prog.resolve,
                });
            });

            prog.resolve();
            return;
        }

        if (expr.type == "if") {
            this.#interprete(expr.cond, scope, {
                ...prog,
                resolve: (cond) => {
                    if (cond.value) {
                        this.#interpreteBody(expr.body.list, scope, prog);
                    } else if (expr.elseStmt) {
                        this.#interpreteBody(
                            expr.elseStmt.body.list,
                            scope,
                            prog,
                        );
                    } else prog.resolve();
                },
            });

            return;
        }

        if (expr.type == "for") {
            this.#interprete(expr.init, scope, {
                ...prog,
                resolve: () => {
                    this.forLoop(expr, scope, prog);
                },
            });

            return;
        }

        if (expr.type === "var-dec") {
            this.#interprete(expr.val, scope, {
                ...prog,
                resolve: (val) => {
                    scope.def_var(expr.name.value, val);
                    prog.resolve();
                },
            });

            return;
        }

        if (expr.type === "func-call") {
            const func = scope.get_func(expr.alias);
            
            if (typeof func !== "function") {
                prog.reject(
                    this.error(
                        `RefrenceError: Function '${expr.alias}' is not avaliable at runtime`,
                    ),
                );
                
                return;
            }

            console.log('call', expr.alias)
            
            this.#interpreteBody(expr.args.list, scope, {
                ...prog,
                resolve: (args) => {
                    console.log(args)
                    func(args, prog);
                },
            });

            return;
        }

        if (expr.type === "op") {
            this.#interprete(expr.left, scope, {
                ...prog,
                resolve: (left) => {
                    this.#interprete(expr.right, scope, {
                        ...prog,
                        resolve: (right) => {
                            const meth = left.get_meth(expr.alias)

                            if (!meth) {
                                prog.reject(this.error(`TypeError: '${expr.alias}' is not a method of ${left.get_class_name()}`))
                            } else {
                                meth(left, [right], prog);
                            }
                        },
                    });
                },
            });

            return;
        }

        if (expr.type === "dot") {
            this.#interprete(expr.left, scope, {
                ...prog,
                resolve: (left) => {
                    prog.resolve(left.get_prop(expr.right.value));
                },
            })
        }
        
        if (expr.type === "unary") {
            this.#interprete(expr.expr, scope, {
                ...prog,
                resolve: (val) => {
                    val.get_meth(expr.alias)(val, [to_byte(1)], {
                        ...prog,
                        resolve: (new_val) => {
                            console.log('i++', val, new_val, expr.alias)
                            scope.set_var(expr.expr.value, new_val);
                            prog.resolve(val);
                        }
                    })
                },
            });
        }

        if (expr.type === "str") {
            prog.resolve(to_str(expr.value));
            return;
        }

        if (expr.type === "char") {
            prog.resolve(to_char(expr.value.charCodeAt(0)));
            return;
        }

        if (expr.type === "ident") {
            const val = scope.get_var(expr.value)
            console.log('var', val)
            if (!val) {
                prog.reject(this.error(`RefrenceError: '${expr.value}' is not defined`));
            } else {
                prog.resolve(scope.get_var(expr.value));
            }
            
            return;
        }

        if (expr.type === "num") {
            prog.resolve(to_byte(parseInt(expr.value)))
            return;
        }
    }
    
    forLoop(stmt, scope, prog) {
        this.#interprete(stmt.cond, scope, {
            ...prog,
            resolve: (cond) => {
                console.log('for cond', cond)
                if (cond.value) {
                    this.#interpreteBody(stmt.body.list, scope, {
                        ...prog,
                        resolve: () => {
                            this.#interprete(stmt.inc, scope, {
                                ...prog,
                                resolve: () => {
                                    this.forLoop(stmt, scope, prog);
                                },
                            });
                        },

                        break: prog.resolve,
                    });
                } else {
                    prog.resolve();
                }
            },
        });
    }

    error(msg) {
        return msg;
    }
}

class Stream {
    #buffer = [];
    #reader;
    #closed = false;
    #onclose;

    read() {
        return new Promise((resolve, reject) => {
            if (this.#buffer.length) {
                resolve(this.#buffer.shift());
                return;
            }

            if (this.#closed) {
                reject(new Error("Stream is closed"));
                return;
            }

            this.#reader = (data) => {
                resolve(data);
                this.#onclose = null;
                this.#reader = null;
            };

            this.#onclose = () => {
                reject(new Error("Stream is closed"));
                this.#onclose = null;
                this.#reader = null;
            };
        });
    }

    write(data) {
        if (this.#closed) throw new Error("Stream is closed");

        if (this.#reader) this.#reader(data);
        else this.#buffer.push(data);
    }

    close() {
        this.#closed = true;
        this.#onclose?.();
    }

    [Symbol.dispose]() {
        this.close();
    }
}

class GlobalScope {
    funcs = new Map();

    constructor(parent) {
        this.parent = parent;
    }

    // Classes
    get_class(name) {
        return this.parent.get_class(name);
    }

    // funcs
    def_func(name, func) {
        this.funcs.set(name, func);
    }

    get_func(name) {
        return this.funcs.get(name);
    }

    // vars
    get_var() {
        return null;
    }
}

class FunctionScope {
    vars = new Map();

    constructor(parent) {
        this.parent = parent;
    }

    // funcs
    get_func(name) {
        return this.parent.get_func(name);
    }

    // vars
    def_var(name, val) {
        this.vars.set(name, val);
    }

    set_var(name, val) {
        this.vars.set(name, val);
    }

    get_var(name) {
        return this.vars.get(name);
    }
}
