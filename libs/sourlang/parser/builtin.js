import DefinationParser from "./dparser.js";
import { Scope, BuiltinScope, ClassScope } from "./scope.js";
import { gen_func_alias, clone_type } from "./util.js";

const BUILTINS = new Scope();
export default BUILTINS;

async function main() {
	const code = await (
		await fetch("./libs/sourlang/parser/builtin.sour")
	).text();

	const parser = new DefinationParser(code);
	const { ast, errors } = parser.parse();

	if (errors.length) {
		console.error(errors);
		throw new Error("Failed to parse buildin.sour");
	}

	ast.filter((node) => node.type === "class-def").forEach((node) => {
		const def = {
			type: "class",
			name: node.name.value,
			scope: new ClassScope(),
			is_type: node.is_type,
			node,
		};

		BUILTINS.def_class(node.name.value, def);
	});

	ast.filter((node) => node.type === "func-def")
		.forEach((node) => BUILTINS.def_func(func_def(node, BUILTINS)));

	BUILTINS.get_all_class().forEach((cls) => {
		const clsBodyScope = new Scope(BUILTINS);

		if (cls.node.generic) {
			cls.node.generic.list.forEach((node) => {
				const def = {
					type: "class",
					name: node.value,
					scope: new ClassScope(),
					is_type: true,
					node,
				}

				clsBodyScope.def_class(node.value, def)
			})

			cls.generic = cls.node.generic.list.map((node) => node.value)
		}
		
		cls.node.body.list.forEach((node) => {
			if (node.type === "var-def") {
				const def = clone_type(get_type(BUILTINS, node.var_type))
				def.is_prop = true
				def.prop_name = node.name.value
				def.class_name = cls.name
				cls.scope.def_prop(node.name.value, def);
				// console.log(cls.scope)
			}

			if (node.type === "func-def") {
				cls.scope.def_meth(func_def(node, clsBodyScope))
			}
		});
	});

	console.log({ BUILTINS });
}

function func_def(node, scope) {
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

function get_type(scope, type) {
	if (type.type === "simple") {
		if (type.name.value === "void") {
			return { type: "simple", name: "void" };
		} else {
			return scope.get_class(type.name.value);
		}
	}
}

await main();
