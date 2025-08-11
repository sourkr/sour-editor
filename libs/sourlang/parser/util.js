export function gen_func_alias(func) {
	const params = func.params.map((p) => gen_type_alias(p.type)).join("__");

	return `${func.name}__${params}`;
}

function gen_type_alias(type) {
	if (type.type === "class") {
		return type.name;
	}

	if (type.type === 'ins') {
		if (!type.generic) {
			return type.cls.name
		}

		const generic = type.generic.map(gen_type_alias)
			.join('_')

		return `${type.cls.name}_${generic}`
	}
}

export function node_to_type(scope, node) {
	if (!node) return;

	if (node.type === "simple") {
        const name = node.name.value
        
		if (name === "void") {
			return [node.doc = { type: "simple", name: "void" }];
		}
        
        if (!scope.has_class(name)) {
            return [null, { msg: `${name} is not a type.`, tok: node }]
        }
        
        const cls = scope.get_class(name)
        
		return [node.doc = { type: 'ins', cls }];
	}
    
    if (node.type === 'generic') {
        const [ ins, err ] = node_to_type(scope, { type: 'simple', name: node.name })
        
        if (err) {
            return [null, err]
        }
        
        ins.generic = []
        
        for(let typeNode of node.generic.list) {
            const [type, err] = node_to_type(scope, typeNode)
            
            if (err) {
                return [TYPE_ERR, err]
            }
            
            ins.generic.push(type)
        }
        
        return [ins]
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

export function node_to_str(node) {
	// console.log(node)

	if (node.type === "dot") {
		return `${node_to_str(node.left)}.${node_to_str(node.right)}`
	}

	if (node.type === "ident") {
		return node.value
	}
}

export const TYPE_ERR = { type: 'simple', name: 'error' }
