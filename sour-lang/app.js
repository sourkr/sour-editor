import { Scope } from "sour-lang/interpreter/scope.js"
import Theme from "../theme.js"

const DEF_APP = new Scope()
export default DEF_APP

DEF_APP.def_func("register_theme__string__Map_string_string", (args, prog) => {
    const colors = new Map()
    args[1].forEach((name, color) => colors.set(name, color))
    Theme.register(args[0].value, colors)
    prog.resolve()
})
