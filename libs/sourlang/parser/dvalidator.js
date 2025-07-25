import DefinationParser from "./dparser.js";
import { Scope } from "./scope.js";
import BUILTINS from "./builtin.js";

export default class DefinationValidator {
	#parser;
	errors = [];

	constructor(input, scope = BUILTINS) {
		this.#parser = new DefinationParser(input);
		this.global = new Scope(scope)
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
			const def = this.def(node.def)
			this.exports.def(def.name, def)
		}

		if (node.type === "func-def") {
			this.func_def(node, this.global)
		}
	}

	func_def(node, scope) {
		const name = node.name.value;

		const params = node.params.list.map((param) => {
			return {
				name: param.name.value,
				type: get_type(scope, param.type),
			};
		});

		const retType = get_type(scope, node.retType);

		const def = {
			type: "func",
			name,
			params,
			retType,
			node,
			doc: node.doc?.value.trim()
		};

		def.alias = gen_func_alias(def);

		return def
	}

	get_type(scope, type) {
		if (type.type === "simple") {
			if (type.name.value === "void") {
				return { type: "simple", name: "void" };
			} else {
				return scope.get_class(type.name.value);
			}
		}
	}
	
	error(msg, tok) {
		this.errors.push({ msg, tok });
	}
}