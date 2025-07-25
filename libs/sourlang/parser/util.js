export function gen_func_alias(func) {
	const params = func.params.map((p) => gen_type_alias(p.type)).join("__");

	return `${func.name}__${params}`;
}

function gen_type_alias(type) {
	if (type.type === "class") {
		return type.name;
	}
}

/** @deprecated */
export function node_to_type(scope, node) {
	if (!node) return;

	if (node.type === "simple") {
		if (node.name.value === "void") {
			return (node.doc = { type: "simple", name: "void" });
		}

		return (node.doc = scope.get_class(node.name.value));
	}
}

export function clone_type(type) {
	if (!type) return { type: "simple", name: "error" };

	if (type.type === "simple") {
		return { type: "simple", name: type.name };
	}

	if (type.type === "class") {
		return {
			type: "class",
			name: type.name,
			scope: type.scope,
			is_type: type.is_type,
		};
	}

	if (type.type === "ins") {
		return {
			type: "ins",
			cls: type.cls,
			generic: type.generic,
		};
	}
}
