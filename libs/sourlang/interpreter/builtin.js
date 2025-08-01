import { BuiltinScope, ClassScope, InstanceScope } from "./scope.js";

const BUILTINS = new BuiltinScope();
export default BUILTINS;


// Char
const char = new ClassScope('char');

char.def_meth("_add__byte", (self, args, prog) => {
	prog.resolve(to_char(self.value + args[0].value));
});

BUILTINS.def_class("char", char);

export function to_char(val) {
	const ins = new InstanceScope(char);
	ins.value = val;
	return ins;
}


// Byte
const byte = new ClassScope('byte');

byte.def_meth("_add__byte", (self, args, prog) => {
	prog.resolve(to_byte(self.value + args[0].value));
});

byte.def_meth("_mul__byte", (self, args, prog) => {
	prog.resolve(to_byte(self.value * args[0].value));
});

byte.def_meth("_div__byte", (self, args, prog) => {
	prog.resolve(to_byte(Math.floor(self.value / args[0].value)));
});

byte.def_meth("_mod__byte", (self, args, prog) => {
	prog.resolve(to_byte(self.value % args[0].value));
})

byte.def_meth("_gt__byte", (self, args, prog) => {
	prog.resolve(to_bool(self.value > args[0].value));
});

byte.def_meth("_lt__byte", (self, args, prog) => {
	prog.resolve(to_bool(self.value < args[0].value));
});

BUILTINS.def_class("byte", byte);

export function to_byte(val) {
	const ins = new InstanceScope(byte);
	ins.value = val % 256;
	return ins;
}


// bool
const bool = new ClassScope('bool')

export function to_bool(val) {
	const ins = new InstanceScope(bool);
	ins.value = val;
	return ins;
}

BUILTINS.def_class("bool", bool)

// string
const string = new ClassScope('string')

string.def_meth("_get__byte", (self, args, prog) => {
	prog.resolve(to_char(self.value.charCodeAt(args[0].value)));
})

export function to_str(val) {
	const ins = new InstanceScope(string);
	ins.value = val;
	ins.set_prop('len', to_byte(val.length))
	return ins;
}

BUILTINS.def_class("string", string)


// Map
const SourMap = new ClassScope("Map")

SourMap.def_meth("set__K__V", (self, args, prog) => {
    self.value.set(...args)
    prog.resolve()
})


export function SourLang_Map() {
    const ins = new InstanceScope(SourMap);
    ins.value = new Map();
    
    ins.forEach = callback => {
        ins.value.forEach((value, key) => callback(key.value, value.value))
    }
    
	return ins;
}
