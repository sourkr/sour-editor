export class Scope {
	#classes = new Map()
	#funcs = new Map()
	#vars = new Map()

	constructor(parent) {
		this.parent = parent
	}

	// Classes
	def_class(name, def) {
		this.#classes.set(name, def)
	}

	get_class(name) {
		return this.#classes.get(name) || this.parent?.get_class(name)
	}

	// Functions
	def_func(name, def) {
		this.#funcs.set(name, def)
	}

	get_func(name) {
		return this.#funcs.get(name) || this.parent?.get_func(name)
	}

	// Variables
	set_var(name, value) {
		this.#vars.set(name, value)
	}
	
	get_var(name) {
		return this.#vars.get(name) || this.parent?.get_var(name)
	}
}

export class BuiltinScope {
	#classes = new Map()
	#funcs = new Map()

	// Classes
	def_class(name, def) {
		this.#classes.set(name, def)
	}

	get_class(name) {
		return this.#classes.get(name)
	}


	// Functions
	def_func(name, def) {
		this.#funcs.set(name, def)
	}

	get_func(name) {
		return this.#funcs.get(name)
	}

	get_all_funcs() {
		return this.#funcs
	}
}

export class ClassScope {
	#props = new Map()
	#meths = new Map()

	constructor(name) {
		this.name = name
	}
	
	// Properties
	def_prop(name, def) {
		this.#props.set(name, def)
	}

	get_prop(name) {
		return this.#props.get(name)
	}


	// Methods
	def_meth(name, def) {
		this.#meths.set(name, def)
	}

	get_meth(name) {
		return this.#meths.get(name)
	}
}

export class InstanceScope {
	#props = new Map();
	#class

	constructor(cls) {
		this.#class = cls;
	}

	// Properties
	set_prop(name, value) {
		this.#props.set(name, value);
	}

	get_prop(name) {
		return this.#props.get(name);
	}

	// Methods
	get_meth(name) {
		return this.#class.get_meth(name);
	}

	// Others
	get_class_name() {
		return this.#class.name;
	}
}