// Sour Lang - Phase 1: Lexer, Parser, Interpreter

const SourLang = (() => {

    // --- TOKEN TYPES ---
    const TOKEN_TYPES = {
        PRINT: 'PRINT',         // 'print' keyword
        STRING: 'STRING',       // "any string"
        NEWLINE: 'NEWLINE',     // \n or \r\n
        WHITESPACE: 'WHITESPACE', // Spaces, tabs
        EOF: 'EOF',             // End Of File
        UNKNOWN: 'UNKNOWN'      // Unrecognized token
    };

    // --- LEXER ---
    function lexer(code) {
        const tokens = [];
        let position = 0;
        let line = 1;
        let column = 0; // 0-indexed column
        const keywordPrint = "print";

        while (position < code.length) {
            const startPos = position;
            const startLine = line;
            const startColumn = column;
            let char = code[position];
            let tokenValue = '';

            // 1. Whitespace (Spaces, Tabs, Newlines)
            if (/\s/.test(char)) {
                if (char === '\n') {
                    tokenValue = '\n';
                    tokens.push({ type: TOKEN_TYPES.NEWLINE, value: tokenValue, line: startLine, column: startColumn, originalLength: 1 });
                    position++;
                    line++;
                    column = 0;
                } else {
                    // Capture sequence of spaces/tabs
                    while (position < code.length && /[ \t]/.test(code[position])) {
                        tokenValue += code[position];
                        position++;
                        column++;
                    }
                    tokens.push({ type: TOKEN_TYPES.WHITESPACE, value: tokenValue, line: startLine, column: startColumn, originalLength: tokenValue.length });
                }
                continue;
            }

            // 2. Keywords: 'print'
            if (code.startsWith(keywordPrint, position)) {
                // Check if it's followed by a space, newline, or EOF, to distinguish from "printsomething"
                const endOfKeywordPos = position + keywordPrint.length;
                if (endOfKeywordPos === code.length || /\s/.test(code[endOfKeywordPos])) {
                    tokens.push({ type: TOKEN_TYPES.PRINT, value: keywordPrint, line: startLine, column: startColumn, originalLength: keywordPrint.length });
                    position += keywordPrint.length;
                    column += keywordPrint.length;
                    continue;
                }
            }

            // 3. String literals: "..."
            if (char === '"') {
                tokenValue = '"'; // Include the opening quote in originalLength calculation for the token
                position++; column++;

                let stringContent = '';
                while (position < code.length && code[position] !== '"') {
                    if (code[position] === '\n') { // Error: strings cannot span newlines in this simple lang
                        // Create UNKNOWN token for the unterminated part before newline
                        // The opening quote is part of this UNKNOWN token's value for error reporting
                        tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue + stringContent, line: startLine, column: startColumn, originalLength: tokenValue.length + stringContent.length });
                        // The newline itself will be tokenized in the next iteration
                        tokenValue = null; // Mark as handled
                        break;
                    }
                    stringContent += code[position];
                    tokenValue += code[position];
                    position++; column++;
                }

                if (tokenValue === null) continue; // Unterminated string due to newline, already tokenized as UNKNOWN

                if (position < code.length && code[position] === '"') { // Properly terminated
                    tokenValue += '"';
                    position++; column++;
                    tokens.push({ type: TOKEN_TYPES.STRING, value: stringContent, line: startLine, column: startColumn, originalLength: tokenValue.length });
                } else { // Unterminated (reached EOF)
                    tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue, line: startLine, column: startColumn, originalLength: tokenValue.length });
                }
                continue;
            }

            // 4. Unknown token (single character)
            // If none of the above matched, it's an unknown character.
            tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: char, line: startLine, column: startColumn, originalLength: 1 });
            position++;
            column++;
        }

        tokens.push({ type: TOKEN_TYPES.EOF, value: null, line, column, originalLength: 0 });
        return tokens;
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
                            value: token.value,
                            line: token.line, // Carry over location info if needed by interpreter/tools
                            column: token.column,
                            originalLength: token.originalLength
                        }
                    };
                    current++; // consume string token
                    return printStatement;
                } else {
                    const errorToken = token || tokens[current-1]; // Use current token or previous if current is null (EOF)
                    return {
                        error: true, // Indicate this is an error object
                        message: `Parser Error: Expected string after 'print', got ${errorToken ? errorToken.type : 'nothing (EOF)'}.`,
                        line: errorToken ? errorToken.line : (tokens[current-1] ? tokens[current-1].line : 1), // Best guess for line
                        column: errorToken ? errorToken.column : (tokens[current-1] ? tokens[current-1].column + tokens[current-1].originalLength : 0), // Best guess for column
                        length: errorToken ? errorToken.originalLength : 1 // Length of the problematic token or 1
                    };
                }
            }

            // Skip over NEWLINE and WHITESPACE tokens when looking for statements.
            // The parser for the interpreter already filters these, but this makes `walk` more robust
            // if used with unfiltered tokens in other contexts.
            if (token && (token.type === TOKEN_TYPES.NEWLINE || token.type === TOKEN_TYPES.WHITESPACE)) {
                current++;
                return walk();
            }

            if (token && token.type === TOKEN_TYPES.EOF) {
                return null;
            }

            // Error: Unexpected token
            // If token is undefined here, it means we went past EOF, should have been caught.
            const errorToken = token || tokens[Math.max(0, current-1)]; // Fallback to previous token if current is somehow undefined
            return {
                error: true,
                message: `Parser Error: Unexpected token '${errorToken.value}' (${errorToken.type}). Expected 'print' or EOF.`,
                line: errorToken.line,
                column: errorToken.column,
                length: errorToken.originalLength
            };
        }

        // Main parsing loop
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
        // Filter out WHITESPACE and NEWLINE tokens before parsing for the interpreter's parser.
        // The highlighting will use the raw token stream from getTokens.
        const filteredTokensForParser = tokens.filter(
            t => t.type !== TOKEN_TYPES.NEWLINE && t.type !== TOKEN_TYPES.WHITESPACE || t === tokens[tokens.length-1] // keep EOF
        );

        const ast = parser(filteredTokensForParser);
        // The parser now returns an object with an 'error' property if an error occurs.
        // This 'error' property itself is the detailed error object.
        if (ast.error && ast.message) { // Check if it's our detailed error object
            return { output: null, error: ast }; // Return the detailed error object directly
        }

        const result = interpreter(ast);
        return result;
    }

    function getTokens(code) { // Renamed for clarity, this is the one for highlighting
        return lexer(code);
    }

    // This is what gets exported
    const SourLangObject = {
        execute,
        getTokens,
        TOKEN_TYPES // Expose token types for external use (e.g., highlighting)
    };

    return SourLangObject;

})();

// If SourLang is an IIFE that returns the object:
// const ActualSourLangObject = SourLang; // or SourLang() if it's a function that returns the object
// export { ActualSourLangObject as SourLang };

// If SourLang is already the object from the IIFE:
export { SourLang };
