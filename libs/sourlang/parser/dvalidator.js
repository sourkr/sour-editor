import DefinationParser from "./dparser.js";
import { Scope } from "./scope.js";
import BUILTINS from "./builtin.js";
import { gen_func_alias, node_to_type } from "./util.js"

export default class DefinationValidator {
	#parser;
	errors = [];

	constructor(input, scope = BUILTINS) {
		this.#parser = new DefinationParser(input);
		this.globals = new Scope(scope)
		this.exports = new Scope()
	}

	validate() {
		const prog = this.#parser.parse();

		if (prog.errors.length) {
			this.errors.push(...prog.errors);
			return;
		}

		prog.ast.forEach((node) => this.stmt(node))
	}
    
	stmt(node) {
		if (node.type === "export") {
			const def = this.stmt(node.def)
			this.exports.def_func(def)
		}

		if (node.type === "func-def") {
		    return this.func_def(node, this.globals)
		}
	}

	func_def(node, scope) {
		const name = node.name.value;

		const params = node.params.list.map(param => {
            const name = param.name.value
            const [ type, err ] = node_to_type(scope, param.type)
            
            if (err) {
                this.error(err.msg, err.tok)
            }
            
			return { name, type }
		})

		const retType = get_type(scope, node.retType)

		const def = {
			type: "func",
			name,
			params,
			retType,
			node,
			doc: node.doc?.value.trim()
		};

		def.alias = gen_func_alias(def);
        this.globals.def_func(def)
        
		return def
	}
	
	error(msg, tok) {
		this.errors.push({ msg, tok });
	}
}

function get_type(scope, type) {
	if (type.type === "simple") {
		if (type.name.value === "void") {
			return { type: "simple", name: "void" };
		} else {
			const cls = scope.get_class(type.name.value);
            return { type: "ins", cls }
		}
	}
    
    if (type.type === 'generic') {
        const cls = scope.get_class(type.name.value)
        const generic = type.generic.map(get_type)
        
        return { type: 'ins', cls, generic }
    }
}