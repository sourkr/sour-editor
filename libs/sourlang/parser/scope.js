export class BuiltinScope {
	#classes = new Map()
	#funcs = new Set()

	// Classes
	def_class(name, def) {
		this.#classes.set(name, def)
	}

	has_class(name) {
		return this.#classes.has(name)
	}

	get_class(name) {
		return this.#classes.get(name)
	}

	get_all_classes() {
		return this.#classes.values()
	}

	// Functions
	def_func(def) {
		this.#funcs.add(def)
	}

	has_func(name) {
		return this.#funcs.values().some(func => func.name.value === name)
	}

	get_funcs(name) {
		return this.#funcs.values().filter(func => func.name.value === name)
	}

	get_all_funcs() {
		return this.#funcs.values()
	}
}

export class ClassScope {
	#props = new Map()

	// Properties
	def_prop(name, def) {
		this.#props.set(name, def)
	}

	has_prop(name) {
		return this.#props.has(name)
	}

	get_prop(name) {
		return this.#props.get(name)
	}

	get_all_props() {
		return this.#props.values()
	}
}