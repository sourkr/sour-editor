// sour_worker.js - Web Worker for Sour Lang Lexing and Parsing

// --- TOKEN TYPES (Copied from sour_lang.js) ---
const TOKEN_TYPES = {
    PRINT: 'PRINT',
    STRING: 'STRING',
    NEWLINE: 'NEWLINE',
    WHITESPACE: 'WHITESPACE',
    EOF: 'EOF',
    UNKNOWN: 'UNKNOWN'
};

// --- LEXER (Copied and adapted from sour_lang.js) ---
function lexer(code) {
    const tokens = [];
    let position = 0;
    let line = 1;
    let column = 0;
    const keywordPrint = "print";

    while (position < code.length) {
        const startLine = line;
        const startColumn = column;
        let char = code[position];
        let tokenValue = '';

        if (/\s/.test(char)) {
            if (char === '\n') {
                tokenValue = '\n';
                tokens.push({ type: TOKEN_TYPES.NEWLINE, value: tokenValue, line: startLine, column: startColumn, originalLength: 1 });
                position++;
                line++;
                column = 0;
            } else {
                while (position < code.length && /[ \t]/.test(code[position])) {
                    tokenValue += code[position];
                    position++;
                    column++;
                }
                tokens.push({ type: TOKEN_TYPES.WHITESPACE, value: tokenValue, line: startLine, column: startColumn, originalLength: tokenValue.length });
            }
            continue;
        }

        if (code.startsWith(keywordPrint, position)) {
            const endOfKeywordPos = position + keywordPrint.length;
            if (endOfKeywordPos === code.length || /\s/.test(code[endOfKeywordPos])) {
                tokens.push({ type: TOKEN_TYPES.PRINT, value: keywordPrint, line: startLine, column: startColumn, originalLength: keywordPrint.length });
                position += keywordPrint.length;
                column += keywordPrint.length;
                continue;
            }
        }

        if (char === '"') {
            tokenValue = '"';
            position++; column++;
            let stringContent = '';
            while (position < code.length && code[position] !== '"') {
                if (code[position] === '\n') {
                    tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue + stringContent, line: startLine, column: startColumn, originalLength: tokenValue.length + stringContent.length });
                    tokenValue = null;
                    break;
                }
                stringContent += code[position];
                tokenValue += code[position];
                position++; column++;
            }
            if (tokenValue === null) continue;
            if (position < code.length && code[position] === '"') {
                tokenValue += '"';
                position++; column++;
                tokens.push({ type: TOKEN_TYPES.STRING, value: stringContent, line: startLine, column: startColumn, originalLength: tokenValue.length });
            } else {
                tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue, line: startLine, column: startColumn, originalLength: tokenValue.length });
            }
            continue;
        }

        tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: char, line: startLine, column: startColumn, originalLength: 1 });
        position++;
        column++;
    }
    tokens.push({ type: TOKEN_TYPES.EOF, value: null, line, column, originalLength: 0 });
    return tokens;
}

// --- AST NODE TYPES (Copied from sour_lang.js) ---
const AST_NODE_TYPES = {
    PROGRAM: 'Program',
    PRINT_STATEMENT: 'PrintStatement',
    STRING_LITERAL: 'StringLiteral'
};

// --- PARSER (Copied and adapted from sour_lang.js) ---
function parser(tokens) {
    const ast = { type: AST_NODE_TYPES.PROGRAM, body: [] };
    let current = 0;

    function walk() {
        let token = tokens[current];
        if (!token) return { error: true, message: "Parser Error: Unexpected end of input.", line: tokens[tokens.length-1]?.line || 1, column: tokens[tokens.length-1]?.column || 0, length: 1};


        if (token.type === TOKEN_TYPES.PRINT) {
            current++;
            let nextToken = tokens[current];

            // Skip whitespace/newlines after 'print' before expecting a string
            while(nextToken && (nextToken.type === TOKEN_TYPES.WHITESPACE || nextToken.type === TOKEN_TYPES.NEWLINE)) {
                current++;
                nextToken = tokens[current];
            }
            token = nextToken; // The token after 'print' (and any intermediate whitespace)

            if (token && token.type === TOKEN_TYPES.STRING) {
                const printStatement = {
                    type: AST_NODE_TYPES.PRINT_STATEMENT,
                    expression: {
                        type: AST_NODE_TYPES.STRING_LITERAL,
                        value: token.value,
                        line: token.line,
                        column: token.column,
                        originalLength: token.originalLength
                    }
                };
                current++;
                return printStatement;
            } else {
                const errorToken = token || tokens[Math.max(0, current-1)];
                return {
                    error: true,
                    message: `Parser Error: Expected string after 'print', got ${errorToken ? errorToken.type : 'nothing (EOF)'}.`,
                    line: errorToken ? errorToken.line : (tokens[Math.max(0,current-1)] ? tokens[Math.max(0,current-1)].line : 1),
                    column: errorToken ? errorToken.column : (tokens[Math.max(0,current-1)] ? tokens[Math.max(0,current-1)].column + (tokens[Math.max(0,current-1)].originalLength || 0) : 0),
                    length: errorToken ? errorToken.originalLength : 1
                };
            }
        }

        if (token && (token.type === TOKEN_TYPES.NEWLINE || token.type === TOKEN_TYPES.WHITESPACE)) {
            current++;
            return walk();
        }

        if (token && token.type === TOKEN_TYPES.EOF) {
            return null;
        }

        const errorToken = token || tokens[Math.max(0, current-1)];
        return {
            error: true,
            message: `Parser Error: Unexpected token '${errorToken.value}' (${errorToken.type}). Expected 'print' or EOF.`,
            line: errorToken.line,
            column: errorToken.column,
            length: errorToken.originalLength
        };
    }

    while (current < tokens.length && tokens[current].type !== TOKEN_TYPES.EOF) {
        const token = tokens[current];
        // Skip leading whitespace/newlines for statements at the top level of the program body
        if (token.type === TOKEN_TYPES.NEWLINE || token.type === TOKEN_TYPES.WHITESPACE) {
            current++;
            continue;
        }

        const statement = walk();
        if (statement) {
            if (statement.error) {
                return statement;
            }
            if(statement.type) {
                ast.body.push(statement);
            } else if (tokens[current] && tokens[current].type !== TOKEN_TYPES.EOF) {
                 // If walk() returned null but it's not EOF, it implies an issue not caught, or an empty valid structure.
                 // For this simple parser, if walk returns null and it's not EOF, it's likely an error state not properly handled.
                 // However, walk() should return an error object for unhandled tokens.
            }
        } else if (tokens[current] && tokens[current].type !== TOKEN_TYPES.EOF) {
             const errorToken = tokens[current];
             return { error: true, message: `Parser Error: Unexpected token at top level: ${errorToken.type}`, line: errorToken.line, column: errorToken.column, length: errorToken.originalLength };
        }
         // If walk returned null due to EOF, the loop condition handles it.
    }
    return ast;
}


// --- INTERPRETER (Copied from sour_lang.js) ---
function interpreter(astNode) {
    let output = [];
    let runtimeError = null;

    function visit(node) {
        if (runtimeError || !node) return;

        switch (node.type) {
            case AST_NODE_TYPES.PROGRAM:
                for (const statement of node.body) {
                    visit(statement);
                    if (runtimeError) break;
                }
                break;
            case AST_NODE_TYPES.PRINT_STATEMENT:
                if (node.expression && node.expression.type === AST_NODE_TYPES.STRING_LITERAL) {
                    output.push(node.expression.value);
                } else {
                    runtimeError = { message: "Interpreter Error: Invalid print statement structure." };
                }
                break;
            default:
                runtimeError = { message: `Interpreter Error: Unknown node type ${node.type}` };
        }
    }

    visit(astNode);
    if (runtimeError) {
        return { output: null, error: runtimeError };
    }
    return { output: output.join('\n'), error: null };
}


// Worker message handler
self.onmessage = function(e) {
    const { code, action } = e.data; // Expect 'action' to distinguish calls

    if (typeof code === 'string') {
        const rawTokens = lexer(code);
        const filteredTokensForParser = rawTokens.filter(
            t => t.type !== TOKEN_TYPES.NEWLINE && t.type !== TOKEN_TYPES.WHITESPACE || t.type === TOKEN_TYPES.EOF
        );

        const parseResult = parser(filteredTokensForParser);

        let ast = null;
        let parseError = null;
        let interpreterOutput = null;
        let interpreterError = null;

        if (parseResult.error) {
            parseError = parseResult;
        } else {
            ast = parseResult;
            if (action === 'execute') { // Only run interpreter if action is 'execute' and no parse error
                const executionResult = interpreter(ast);
                interpreterOutput = executionResult.output;
                interpreterError = executionResult.error;
            }
        }

        self.postMessage({
            type: action || 'lint', // Echo back action type, default to 'lint'
            tokens: rawTokens,
            ast: ast,
            error: parseError, // This is the parse error
            interpreterOutput: interpreterOutput,
            runtimeError: interpreterError // This is the interpreter/runtime error
        });
    }
};
