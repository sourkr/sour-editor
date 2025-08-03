import Parser from "../libs/sourlang/parser/parser.js"

const code = `
    rea("dfj", map)
`

const parser = new Parser(code, "test.sour")
const ast = parser.parse()

console.log(ast.errors)
console.log(ast.ast)
