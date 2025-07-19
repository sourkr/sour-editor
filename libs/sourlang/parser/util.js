export function gen_func_alias(func) {
	const params = func.params
		.map(p => gen_type_alias(p.type))
		.join('__')
	
	return `${func.name}__${params}`
}

function gen_type_alias(type) {
	if (type.type === 'class') {
		return type.name
	}
}