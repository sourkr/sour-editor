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