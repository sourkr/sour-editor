import Validator from "../parser/validator.js";
import { Scope, BuiltinScope, InstanceScope } from "./scope.js"
import BUILTINS, { to_byte, to_char, to_str } from "./builtin.js";

export default class Interpreter {
    #validator;
    #file

    inputStream = new Stream();
    errorStream = new Stream();
    outputStream = new Stream();

    exports = new BuiltinScope()

    globals = new GlobalScope(BUILTINS)

    constructor(file) {
        this.#validator = new Validator(file.read(), file);
        this.#file = file
    }

    interprete(_prog) {
        const prog = this.#validator.validate();

        if (prog.errors.length) {
            prog.errors.forEach((err) => this.errorStream.write(err.toString()));
            return;
        }


        this.globals.def_func('_stdout__char', (args, prog) => {
            console.log('from', this.name)
            this.inputStream.write(String.fromCharCode(args[0].value));
            prog.resolve();
        })

        this.globals.def_func("_stderr__char", (args, prog) => {
            this.errorStream.write(String.fromCharCode(args[0].value));
            prog.resolve();
        });

        this.globals.def_func("_stdin__", (_args, prog) => {
            this.inputStream.read()
                .then((char) => prog.resolve(to_char(char.charCodeAt(0))));
        });

        // const stack = []
        
        this.#interpreteBody(prog.ast, this.globals, {
            resolve: () => {
                if (!_prog) {
                    this.outputStream.close();
                    this.errorStream.close();
                    this.inputStream.close();
                }
                
                _prog?.resolve()
            },

            reject: (err) => {
                this.errorStream.write(err.toString());

                if (!_prog) {
                    this.outputStream.close();
                    this.errorStream.close();
                    this.inputStream.close();
                }

                _prog?.reject(err)
            },

            stack: []
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
        if (expr.type == "export") {
            this.#interprete(expr.def, scope, {
                ...prog,
                resolve: ({ type, name, def }) => {
                    if (type == "func") {
                        this.exports.def_func(name, def);
                    }
                    
                    prog.resolve()
                }
            });

            return
        }

        if (expr.type == "import") {
            const path = expr.path.value
            const file = this.#file.parent.child(path + '.sour')
            const interpreter = new Interpreter(file)
            interpreter.name = 'module'
            interpreter.inputStream = this.inputStream
            interpreter.errorStream = this.errorStream
            interpreter.outputStream = this.outputStream
            interpreter.interprete({
                ...prog,
                reject: (err) => {
                    console.warn('import failed', err)
                },
                resolve: () => {
                    // console.log('import', interpreter.exports)
                    interpreter.exports.get_all_funcs().forEach((func, name) => {
                        this.globals.def_func(name, func)
                    })
                    prog.resolve()
                }
            })

            return
        }
        
        if (expr.type == "func-dec") {
            scope.def_func(expr.alias, (args, prog) => {
                const funcScope = new FunctionScope(scope);
                
                expr.params.list.forEach((param, i) =>
                    funcScope.def_var(param.name.value, args[i]),
                );

                // this.#stack.push(expr.name.value)
                this.#interpreteBody(expr.body.list, funcScope, {
                    ...prog,
                    resolve: (res) => {
                        // this.#stack.pop()
                        prog.resolve();
                    },
                    return: prog.resolve,
                });
            });

            // console.log('def func', expr.alias, scope.get_func(expr.alias))
            prog.resolve({ type: "func", name: expr.alias, def: scope.get_func(expr.alias) });
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
                prog.reject(this.error(`RefrenceError: '${expr.name.value}' is not a function`, expr.name, prog));
                return;
            }

            this.#interpreteBody(expr.args.list, scope, {
                ...prog,
                resolve: (args) => {
                    prog.stack.push({ name: expr.name.value, path: this.#file.path, token: expr.name })
                    func(args, {
                        ...prog,
                        resolve: (val) => {
                            prog.stack.pop()
                            prog.resolve(val);
                        }
                    })
                }
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

            return 
        }
        
        if (expr.type === "unary") {
            this.#interprete(expr.expr, scope, {
                ...prog,
                resolve: (val) => {
                    val.get_meth(expr.alias)(val, [to_byte(1)], {
                        ...prog,
                        resolve: (new_val) => {
                            scope.set_var(expr.expr.value, new_val);
                            prog.resolve(val);
                        }
                    })
                },
            });

            return
        }

        if (expr.type === "index") {
            this.#interprete(expr.access, scope, {
                ...prog,
                resolve: (access) => {
                    this.#interprete(expr.expr, scope, {
                        ...prog,
                        resolve: (index) => {
                            const meth = access.get_meth(expr.alias)
                            meth(access, [index], prog)
                        }
                    })
                }
            })

            return
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
            
            if (!val) {
                prog.reject(this.error(`RefrenceError: '${expr.value}' is not defined`));
            } else {
                prog.resolve(val);
            }
            
            return;
        }

        if (expr.type === "num") {
            prog.resolve(to_byte(parseInt(expr.value)))
            return;
        }

        console.warn(`${expr.type} is not implemented`)
        // prog.reject(this.error(`SyntaxError: '${expr.type}' is not a valid expression`, expr, prog))
    }
    
    forLoop(stmt, scope, prog) {
        this.#interprete(stmt.cond, scope, {
            ...prog,
            resolve: (cond) => {
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

    error(msg, token, prog) {
        const path = this.#file.path.slice(1)
        
        const header = `${msg} at ${path}:${token.start?.lineno ?? -1}:${token.start?.col ?? -1}`
        const stack = prog.stack.toReversed()
            .map(({ name, path, token }) => `    at ${name} (${path.slice(1)}:${token?.start.lineno ?? -1}:${token?.start.col ?? -1})`)
            .join('\n')
        
        return `${header}\n${stack}`;
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
        console.log('stream is closed')
    }

    // [Symbol.dispose]() {
    //     this.close();
    // }
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
