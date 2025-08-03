export class Scope {
	vars = new Map();
	funcs = new Set();
	classes = new Map();
	parent;

	constructor(parent) {
		this.parent = parent;
	}

	// Classes
	def_class(name, def) {
		this.classes.set(name, def);
	}

	has_class(name) {
		return this.classes.has(name) || this.parent?.has_class(name);
	}

	get_class(name) {
		return this.classes.get(name) || this.parent?.get_class(name);
	}

	*get_all_class() {
		yield* this.classes.values();
		if (this.parent) yield* this.parent.get_all_class();
	}

	// Functions
	def_func(def) {
		this.funcs.add(def);
	}

	has_func(name) {
		return this.get_all_funcs()
			.some((func) => func.name === name)
	}

	*get_funcs(name) {
		yield* this.get_all_funcs()
			.filter((func) => func.name === name)
	}

	*get_all_funcs() {
		yield* this.funcs.values();
		if (this.parent) yield* this.parent.get_all_funcs();
	}

	// Variables
	def_var(name, def) {
		this.vars.set(name, def);
	}

	has_var(name) {
		return this.vars.has(name) || this.parent?.has_var(name);
	}

	get_var(name) {
		return this.vars.get(name) || this.parent?.get_var(name);
	}

	*get_all_vars() {
		yield* this.vars.entries().map((e) => {
			return { name: e[0], type: e[1] };
		});

		if (this.parent) yield* this.parent.get_all_vars();
	}

	toString() {
		const funcs = this.funcs.values()
			.map((func) => func.name)
			.toArray()

		const parent = (this.parent + '')
			.split('\n')
			.map(line => '    ' + line)
			.join('\n')
		
		return `{\n    funcs: [${funcs}]\n    parent: ${parent}\n}`
	}
}

class InstanceScope {
	constructor(cls, generic) {
		this.cls = cls
		this.genrics = genrics
	}

	has_meth(name) {
		return this.cls.has_meth(name)
	}

	get_meths(name) {
		return this.cls.get
	}
}

/** @description */
export class BuiltinScope {
	#classes = new Map();
	#funcs = new Set();

	// Classes
	def_class(name, def) {
		this.#classes.set(name, def);
	}

	has_class(name) {
		return this.#classes.has(name);
	}

	get_class(name) {
		return this.#classes.get(name);
	}

	get_all_classes() {
		return this.#classes.values();
	}

	// Functions
	def_func(def) {
		this.#funcs.add(def);
	}

	has_func(name) {
		return this.#funcs.values().some((func) => func.name.value === name);
	}

	get_funcs(name) {
		return this.#funcs.values().filter((func) => func.name.value === name);
	}

	get_all_funcs() {
		return this.#funcs.values();
	}
}

export class ClassScope {
	#props = new Map();
	#meths = new Set();

	// Properties
	def_prop(name, def) {
		this.#props.set(name, def);
	}

	has_prop(name) {
		return this.#props.has(name);
	}

	get_prop(name) {
		return this.#props.get(name);
	}

	get_all_props() {
		return this.#props.values();
	}

	// Methods
	def_meth(def) {
		this.#meths.add(def);
	}

	has_meths(name) {
		return this.#meths.values().some((func) => func.name === name);
	}

	get_meths(name) {
		return this.#meths.values().filter((func) => func.name === name);
	}

	get_all_meths() {
		return this.#meths.values();
	}
}
