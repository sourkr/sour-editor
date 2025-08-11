import Validator from "../parser/validator.js";
import { Scope, BuiltinScope, InstanceScope, ClassScope } from "./scope.js"
import BUILTINS, { to_byte, to_char, to_str } from "./builtin.js"
import File from "../../../file.js"
import { node_to_str } from "../parser/util.js";

export default class Interpreter {
    #modules = new Map()

    #validator
    #file

    inputStream = new Stream();
    errorStream = new Stream();
    outputStream = new Stream();

    exports = new Scope()

    globals = new Scope(BUILTINS)

    constructor(file) {
        this.#validator = new Validator(file.read(), file);
        this.#file = file
    }

    add_module(name, def, scope) {
        this.#validator.add_module(name, def)
        this.#modules.set(name, scope)
    }

    interprete(_prog) {
        const prog = this.#validator.validate();

        if (prog.errors.length) {
            prog.errors.forEach((err) => this.errorStream.write(err.toString()));
            _prog?.reject(prog.errors[0].toString())
            return;
        }


        this.globals.def_func('_stdout__char', (args, prog) => {
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

        // File
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

            if (this.#modules.has(path)) {
                const module = this.#modules.get(path)

                module.get_all_funcs()
                    .forEach(entry  => this.globals.def_func(entry.name, entry.value))

                module.get_all_classes()
                    .forEach(cls  => this.globals.def_class(cls.name, cls))

                prog.resolve()
            } else if (new File(`/libs/${path}.sour`).exists()) {
                const file = new File(`/libs/${path}.sour`)
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
                        interpreter.exports.get_all_funcs()
                            .forEach(e => {
                                this.globals.def_func(e.name, e.value)
                            })

                        prog.resolve()
                    }
                })

            } else {
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
                        interpreter.exports.get_all_funcs().forEach((func, name) => {
                            this.globals.def_func(name, func)
                        })
                        prog.resolve()
                    }
                })
            }

            return
        }

        if (expr.type === "class-dec") {
            const name = expr.name.value
            const cls = new ClassScope()
            const clsBosyScope = new Scope(scope)

            expr.body.list.forEach(node => {
                if (node.type === 'func-dec') {
                    const func = (self, args, prog) => {
                        const funcScope = new Scope(clsBosyScope)

                        node.params.list.forEach((param, i) =>
                            funcScope.set_var(param.name.value, args[i]))

                        funcScope.set_var("this", self)

                        this.#interpreteBody(node.body.list, funcScope, {
                            ...prog,
                            resolve: (res) => {
                                prog.resolve();
                            },
                            return: prog.resolve,
                        })
                    }

                    cls.def_meth(node.alias, func)
                    // clsBosyScope.def_func(node.alias, func)
                }
            })

            scope.def_class(name, cls)
            prog.resolve()
            return
        }


        // Def
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

        if (expr.type == "while") {
            this.whileLoop(expr, scope, prog)
            return;
        }

        if (expr.type === "var-dec") {
            this.#interprete(expr.val, scope, {
                ...prog,
                resolve: (val) => {
                    scope.set_var(expr.name.value, val);
                    prog.resolve();
                },
            });

            return;
        }

        if (expr.type === "func-call") {
            if (expr.access.type === 'ident') {
                const func = scope.get_func(expr.alias);

                if (typeof func !== "function") {
                    console.warn(expr.alias)
                    prog.reject(this.error(`RefrenceError: '${expr.access.value}' is not a function`, expr.access, prog));
                    return;
                }

                this.#interpreteBody(expr.args.list, scope, {
                    ...prog,
                    resolve: (args) => {
                        prog.stack.push({ name: expr.access.value, path: this.#file.path, token: expr.access })
                        func(args, {
                            ...prog,
                            resolve: (val) => {
                                prog.stack.pop()
                                prog.resolve(val);
                            }
                        })
                    }
                })
            } else if (expr.access.type === 'dot') {
                this.#interprete(expr.access.left, scope, {
                    ...prog,
                    resolve: (left) => {
                        const meth = left.get_meth(expr.alias)

                        if (!meth) {
                            prog.reject(this.error(`RefrenceError: '${expr.access.right.value}' is not a method of ${left.get_class_name()}`, expr.access.right, prog))
                            return
                        }

                        this.#interpreteBody(expr.args.list, scope, {
                            ...prog,
                            resolve: (args) => {
                                prog.stack.push({ name: expr.access.right.value, path: this.#file.path, token: expr.access.right })
                                try {
                                    meth(left, args, {
                                        ...prog,
                                        resolve: (val) => {
                                            prog.stack.pop()
                                            prog.resolve(val);
                                        }
                                    })
                                } catch (err) {
                                    console.error(err)
                                    prog.reject(this.error(`RangeError: ${err.message}`, expr, prog))
                                }
                            }
                        })
                    }
                })
            }

            return;
        }

        if (expr.type === 'new') {
            const name = expr.name.value
            const cls = scope.get_class(name)
            const ins = new InstanceScope(cls)
            const func = cls.get_meth(expr.alias)

            this.#interpreteBody(expr.args.list, scope, {
                ...prog,
                resolve: args => {
                    func(ins, args, {
                        ...prog,
                        resolve: () => {
                            prog.resolve(ins)
                        }
                    })
                }
            })

            return
        }

        if (expr.type === "ret") {
            this.#interprete(expr.value, scope, {
                ...prog,
                resolve: prog.return
            })

            return
        }

        if (expr.type === "assign") {
            this.#interprete(expr.access.left, scope, {
                ...prog,
                resolve: left => {
                    this.#interprete(expr.value, scope, {
                        ...prog,
                        resolve: value => {
                            left.set_prop(expr.access.right.value, value)
                            prog.resolve(value)
                        }
                    })
                }
            })

            return
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

        if (expr.type === "op2") {
            this.#interprete(expr.left, scope, {
                ...prog,
                resolve: (left) => {
                    this.#interprete(expr.right, scope, {
                        ...prog,
                        resolve: (right) => {
                            const meth = left.get_meth(expr.alias)

                            if (!meth) {
                                prog.reject(this.error(`TypeError: '${expr.alias}' is not a method of ${left.get_class_name()}`, expr, prog))
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
            if (expr.expr.type === "ident") {
                const name = expr.expr.value
                const val = scope.get_var(name)

                val.get_meth(expr.alias)(val, [to_byte(1)], {
                    ...prog,
                    resolve: new_val => {
                        scope.set_var(name, new_val)
                        prog.resolve(val)
                    }
                })

                return
            }

            if (expr.expr.type == "dot") {
                this.#interprete(expr.expr.left, scope, {
                    ...prog,
                    resolve: access => {
                        const name = expr.expr.right.value
                        const val = access.get_prop(name)

                        val.get_meth(expr.alias)(val, [to_byte(1)], {
                            ...prog,
                            resolve: new_val => {
                                access.set_prop(name, new_val)
                                prog.resolve(val)
                            }
                        })
                    }
                })

                return
            }

            this.#interprete(expr.expr, scope, {
                ...prog,
                resolve: val => {
                    val.get_meth(expr.alias)(val, [to_byte(1)], {
                        ...prog,
                        resolve: (new_val) => {
                            if (expr.expr.type === "ident") {
                                scope.set_var(expr.expr.value, new_val);
                            }

                            if (expr.expr.type === "dot") {
                            }

                            prog.resolve(val);
                        }
                    })
                    
                }
            })
        }

        if (expr.type === "index") {
            this.#interprete(expr.access, scope, {
                ...prog,
                resolve: (access) => {
                    this.#interprete(expr.expr, scope, {
                        ...prog,
                        resolve: (index) => {
                            const meth = access.get_meth(expr.alias)

                            if (typeof meth !== "function") {
                                console.warn("alias", expr)
                                prog.reject(this.error(`${node_to_str(expr.access)}._get is not a method.`, expr, prog))
                                return
                            }

                            meth(access, [index], prog)
                        }
                    })
                }
            })

            return
        }

        if (expr.type === "str") {
            prog.resolve(to_str(expr.value
                .replace("\\n", '\n')));
            return;
        }

        if (expr.type === "char") {
            let value = expr.value

            if (value === "\\n") value = '\n'

            prog.resolve(to_char(value.charCodeAt(0)));
            return;
        }

        if (expr.type === "ident") {
            const val = scope.get_var(expr.value)
            
            if (!val) {
                prog.reject(this.error(`RefrenceError: '${expr.value}' is not defined`, expr, prog));
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

    whileLoop(node, scope, prog) {
        this.#interprete(node.cond, scope, {
            ...prog,
            resolve: cond => {
                if (cond.value) {
                    this.#interpreteBody(node.body.list, scope, {
                        ...prog,
                        resolve: () => {
                            this.whileLoop(node, scope, prog)
                        }
                    })
                } else {
                    prog.resolve()
                }
            }
        })
    }

    error(msg, token, prog) {
        const path = this.#file.path.slice(1)
        
        const header = `${msg} at ${path}:${token.start?.lineno ?? -1}:${token.start?.col ?? -1}`
        const stack = prog.stack.toReversed()
            .map(({ name, path, token }) => `    at ${name} (${path.slice(1)}:${token?.start.lineno ?? -1}:${token?.start.col ?? -1})`)
            .join('\n')
        
        return `${header}\n${stack}`;
    }

    promiseExpr(expr, scope, prog) {
        
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
