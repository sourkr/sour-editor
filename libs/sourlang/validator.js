import Parser from './parser.js';

export default class Validator {
    constructor(code) {
        this.code = code;
        this.errors = [];
        this.parser = new Parser(code);
        this.builtins = {}; // To store parsed built-in functions

        this._loadBuiltins(); // Load built-in functions when validator is initialized
    }

    async _loadBuiltins() {
        try {
            const response = await fetch('./libs/sourlang/builtin.sour');
            const text = await response.text();
            this._parseBuiltins(text);
        } catch (error) {
            console.error('Failed to load built-in functions:', error);
            // Handle error, e.g., push an error to this.errors
        }
    }

    _parseBuiltins(builtinCode) {
        const lines = builtinCode.split('\n');
        let currentDoc = '';
        for (const line of lines) {
            if (line.startsWith('/**') && line.endsWith('*/')) {
                currentDoc = line.substring(3, line.length - 2).trim();
            } else if (line.startsWith('func ')) {
                const funcSignature = line.substring(5).trim();
                const funcNameMatch = funcSignature.match(/^(\w+)\\((.*)\\):\\s*(\\w+)$/);
                if (funcNameMatch) {
                    const name = funcNameMatch[1];
                    const params = funcNameMatch[2].split(',').map(p => p.trim()).filter(p => p !== '').map(p => {
                        const [paramName, paramType] = p.split(':').map(s => s.trim());
                        return { name: paramName, type: paramType };
                    });
                    const returnType = funcNameMatch[3];
                    this.builtins[name] = {
                        doc: currentDoc,
                        params: params,
                        returnType: returnType
                    };
                }
                currentDoc = ''; // Reset doc after parsing a function
            }
        }
    }

    validate() {
        const parseResult = this.parser.parse();
        this.errors = [...parseResult.errors];
        const ast = parseResult.ast;

        this._typeCheck(ast);

        return { ast, errors: this.errors };
    }

    _typeCheck(ast) {
        ast.forEach(node => {
            if (!node) return;

            if (node.type === 'print') {
                if (!node.expr) {
                    this.errors.push({ message: 'print statement expects an expression', start: node.kw.start, end: node.kw.end });
                }
            } else if (node.type === 'func-call') {
                const builtin = this.builtins[node.name.value];
                if (builtin) {
                    // Validate number of arguments
                    if (node.args.list.length !== builtin.params.length) {
                        this.errors.push({
                            message: `${node.name.value} expects ${builtin.params.length} argument(s) but got ${node.args.list.length}`,
                            start: node.name.start,
                            end: node.name.end
                        });
                    } else {
                        // Validate argument types
                        node.args.list.forEach((arg, index) => {
                            if (builtin.params[index] && arg.type !== builtin.params[index].type) {
                                this.errors.push({
                                    message: `Argument ${index + 1} of ${node.name.value} expects type ${builtin.params[index].type} but got ${arg.type}`,
                                    start: arg.start,
                                    end: arg.end
                                });
                            }
                        });
                    }
                } 
            }
        });
    }
}
