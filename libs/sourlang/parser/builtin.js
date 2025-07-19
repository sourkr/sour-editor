import DefinationParser from "./dparser.js";
import { BuiltinScope, ClassScope } from "./scope.js";
import { gen_func_alias } from "./util.js";

const BUILTINS = new BuiltinScope();
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

	ast.filter((node) => node.type === "func-def").forEach((node) => {
		const name = node.name.value;

		const params = node.params.list.map((param) => {
			return {
				name: param.name.value,
				type: get_type(BUILTINS, param.type),
			};
		});

		const retType = get_type(BUILTINS, node.retType);

		const def = {
			type: "func",
			name: node.name.value,
			params,
			retType,
			node,
		};

		def.alias = gen_func_alias(def);

		BUILTINS.def_func(def);
	});

	BUILTINS.get_all_classes().forEach((cls) => {
		cls.node.body.list.forEach((node) => {
			if (node.type === "var-dec") {
				const def = get_type(BUILTINS, node.type);
				cls.scope.def_prop(node.name.value, def);
			}
		});
	});

	console.log({ BUILTINS });
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
