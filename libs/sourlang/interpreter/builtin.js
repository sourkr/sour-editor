import { BuiltinScope, ClassScope } from "./scope.js"

const BUILTINS = new BuiltinScope()
export default BUILTINS

{
	const char = new ClassScope()

	char.def_meth('constructor', (self, args, prog) => {
		self.value = args[0]
		prog.resolve()
	})
	
	BUILTINS.def_class('char', char)
}