// Sour Lang - Phase 1: Lexer, Parser, Interpreter

const SourLang = (() => {

    // --- TOKEN TYPES ---
    const TOKEN_TYPES = {
        PRINT: 'PRINT',         // 'print' keyword
        STRING: 'STRING',       // "any string"
        NEWLINE: 'NEWLINE',     // \n or \r\n
        EOF: 'EOF',             // End Of File
        UNKNOWN: 'UNKNOWN'      // Unrecognized token
    };

    // --- LEXER ---
    function lexer(code) {
        const tokens = [];
        let position = 0;

        const keywordPrint = "print";

        while (position < code.length) {
            let char = code[position];

            // 1. Whitespace (ignore, but helps separate tokens)
            if (/\s/.test(char)) {
                if (char === '\n') {
                    tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n' });
                }
                position++;
                continue;
            }

            // 2. Keywords: 'print'
            if (code.substring(position, position + keywordPrint.length) === keywordPrint) {
                // Check if it's followed by a space or end of line/file, to distinguish from "printsomething"
                if (position + keywordPrint.length === code.length || /\s/.test(code[position + keywordPrint.length])) {
                    tokens.push({ type: TOKEN_TYPES.PRINT, value: keywordPrint });
                    position += keywordPrint.length;
                    continue;
                }
            }

            // 3. String literals: "..."
            if (char === '"') {
                let value = '';
                position++; // consume the opening quote
                while (position < code.length && code[position] !== '"') {
                    value += code[position];
                    position++;
                }
                if (position < code.length && code[position] === '"') {
                    position++; // consume the closing quote
                    tokens.push({ type: TOKEN_TYPES.STRING, value });
                } else {
                    // Unterminated string
                    tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: `"${value}` });
                    // Potentially report error or try to recover
                }
                continue;
            }

            // 4. Unknown token
            tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: char });
            position++;
        }

        tokens.push({ type: TOKEN_TYPES.EOF, value: null });
        return tokens.filter(token => token.type !== TOKEN_TYPES.NEWLINE || tokens.length === 1); // Keep newline if it's the only token for empty lines, otherwise filter out for now.
                                                                                                   // Parser will handle meaningful newlines.
    }

    // --- AST NODE TYPES ---
    const AST_NODE_TYPES = {
        PROGRAM: 'Program',
        PRINT_STATEMENT: 'PrintStatement',
        STRING_LITERAL: 'StringLiteral'
    };

    // --- PARSER ---
    // Basic parser for 'print "string"' statements.
    // Expects a flat list of print statements for now.
    function parser(tokens) {
        const ast = { type: AST_NODE_TYPES.PROGRAM, body: [] };
        let current = 0;

        function walk() {
            let token = tokens[current];

            if (token.type === TOKEN_TYPES.PRINT) {
                // Expect a string token next
                current++; // consume 'print'
                token = tokens[current];

                if (token && token.type === TOKEN_TYPES.STRING) {
                    const printStatement = {
                        type: AST_NODE_TYPES.PRINT_STATEMENT,
                        expression: {
                            type: AST_NODE_TYPES.STRING_LITERAL,
                            value: token.value
                        }
                    };
                    current++; // consume string token
                    return printStatement;
                } else {
                    // Error: Expected a string after 'print'
                    return { error: `Parser Error: Expected string after 'print', got ${token ? token.type : 'EOF'}` };
                }
            }

            // Skip over newlines for now, effectively treating each print on any line as a new statement
            if (token && token.type === TOKEN_TYPES.NEWLINE) {
                current++;
                return walk(); // Continue to next token
            }


            if (token.type === TOKEN_TYPES.EOF) {
                return null; // End of parsing for statements
            }

            // Error: Unexpected token
            return { error: `Parser Error: Unexpected token ${token.type}` };
        }

        while (current < tokens.length) {
            const token = tokens[current];
            if (token.type === TOKEN_TYPES.EOF) {
                break;
            }

            // Handle NEWLINE tokens at the top level of the program body
            // This allows multiple print statements separated by newlines.
            if (token.type === TOKEN_TYPES.NEWLINE) {
                current++; // Consume the newline
                continue;  // And look for the next statement
            }

            const statement = walk();
            if (statement) {
                if (statement.error) {
                    return statement; // Propagate error object
                }
                if(statement.type) { // Ensure it's a valid node, not null from EOF in walk()
                    ast.body.push(statement);
                }
            } else if (tokens[current] && tokens[current].type !== TOKEN_TYPES.EOF) {
                 // If walk returns null but it's not EOF, something is wrong or it's an unhandled token.
                 // This case should ideally be caught by walk()'s error reporting.
                 return { error: `Parser Error: Unexpected token at top level: ${tokens[current].type}` };
            }

            // If walk returned null because of EOF, the main loop condition (current < tokens.length) will handle it.
            // If walk consumed tokens, current is already advanced.
        }
        return ast;
    }

    // --- INTERPRETER ---
    function interpreter(node) {
        let output = []; // Using an array to collect lines of output

        function visit(node) {
            if (!node) return; // Should not happen with a valid AST

            switch (node.type) {
                case AST_NODE_TYPES.PROGRAM:
                    for (const statement of node.body) {
                        visit(statement);
                    }
                    break;
                case AST_NODE_TYPES.PRINT_STATEMENT:
                    if (node.expression && node.expression.type === AST_NODE_TYPES.STRING_LITERAL) {
                        output.push(node.expression.value);
                    } else {
                        // This should ideally be caught by the parser
                        return { error: "Interpreter Error: Invalid print statement structure." };
                    }
                    break;
                // StringLiteral nodes are handled within PrintStatement, no direct visit action needed at top level.
                default:
                    return { error: `Interpreter Error: Unknown node type ${node.type}` };
            }
        }

        const result = visit(node);
        if (result && result.error) { // Check if visit itself returned an error object
            return { output: null, error: result.error };
        }

        return { output: output.join('\n'), error: null };
    }

    // --- PUBLIC API ---
    function execute(code) {
        const tokens = lexer(code);
        const filteredTokens = tokens.filter(token => token.type !== TOKEN_TYPES.NEWLINE || token === tokens[tokens.length-1]);

        const ast = parser(filteredTokens);
        if (ast.error) {
            return { output: null, error: ast.error };
        }

        const result = interpreter(ast);
        return result;
    }

    return {
        execute
    };

})();
