// sour_worker.js - Web Worker for Sour Lang Lexing and Parsing

// --- CharStream Class ---
class CharStream {
    constructor(input) {
        this.input = input;
        this.position = 0;
        this.line = 1;
        this.column = 0; // 0-indexed
    }

    // Returns the next character and consumes it
    next() {
        if (this.eof()) {
            return null; // Or throw error, or return special EOF char
        }
        const char = this.input[this.position];
        this.position++;
        if (char === '\n') {
            this.line++;
            this.column = 0;
        } else {
            this.column++;
        }
        return char;
    }

    // Returns the next character without consuming it
    peek() {
        if (this.eof()) {
            return null;
        }
        return this.input[this.position];
    }

    // Returns true if at the end of the input stream
    eof() {
        return this.position >= this.input.length;
    }

    // Gets current location {line, column, index}
    getCurrentLocation() {
        return {
            line: this.line,
            column: this.column,
            index: this.position
        };
    }
}

// --- TOKEN TYPES (Copied from sour_lang.js) ---
const TOKEN_TYPES = {
    PRINT: 'PRINT',
    STRING: 'STRING',
    NEWLINE: 'NEWLINE',
    WHITESPACE: 'WHITESPACE',
    EOF: 'EOF',
    UNKNOWN: 'UNKNOWN'
};

// --- LEXER (Refactored to use CharStream) ---
function lexer(code) {
    const tokens = [];
    const stream = new CharStream(code);
    const keywordPrint = "print";

    while (!stream.eof()) {
        const startLocation = stream.getCurrentLocation();
        let char = stream.peek();
        let tokenValue = '';

        // 1. Whitespace (Spaces, Tabs, Newlines)
        if (/\s/.test(char)) {
            if (char === '\n') {
                tokenValue = stream.next(); // Consume newline
                tokens.push({ type: TOKEN_TYPES.NEWLINE, value: tokenValue, line: startLocation.line, column: startLocation.column, originalLength: 1 });
            } else {
                // Capture sequence of spaces/tabs
                while (!stream.eof() && /[ \t]/.test(stream.peek())) {
                    tokenValue += stream.next();
                }
                tokens.push({ type: TOKEN_TYPES.WHITESPACE, value: tokenValue, line: startLocation.line, column: startLocation.column, originalLength: tokenValue.length });
            }
            continue;
        }

        // 2. Keywords: 'print'
        // Check if the input from current stream position starts with "print"
        if (stream.input.substring(stream.position).startsWith(keywordPrint)) {
            const endOfKeywordPosInStream = stream.position + keywordPrint.length;
            // Check if it's followed by a space, newline, or EOF
            if (endOfKeywordPosInStream === stream.input.length || /\s/.test(stream.input[endOfKeywordPosInStream])) {
                // Consume the keyword
                for(let i=0; i < keywordPrint.length; i++) stream.next();
                tokens.push({ type: TOKEN_TYPES.PRINT, value: keywordPrint, line: startLocation.line, column: startLocation.column, originalLength: keywordPrint.length });
                continue;
            }
        }

        // 3. String literals: "..."
        if (char === '"') {
            let stringContent = '';
            stream.next(); // Consume opening quote "
            tokenValue = '"'; // Start token value for length calculation

            while (!stream.eof() && stream.peek() !== '"') {
                if (stream.peek() === '\n') { // Error: strings cannot span newlines
                    // Tokenize the unterminated part as UNKNOWN
                    tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue + stringContent, line: startLocation.line, column: startLocation.column, originalLength: tokenValue.length + stringContent.length });
                    tokenValue = null; // Mark as handled, newline will be picked up next iteration
                    break;
                }
                const nextChar = stream.next();
                stringContent += nextChar;
                tokenValue += nextChar;
            }

            if (tokenValue === null) continue; // Handled by UNKNOWN token for string with newline

            if (!stream.eof() && stream.peek() === '"') { // Properly terminated
                tokenValue += stream.next(); // Consume closing quote "
                tokens.push({ type: TOKEN_TYPES.STRING, value: stringContent, line: startLocation.line, column: startLocation.column, originalLength: tokenValue.length });
            } else { // Unterminated (reached EOF)
                tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue, line: startLocation.line, column: startLocation.column, originalLength: tokenValue.length });
            }
            continue;
        }

        // 4. Unknown token (single character if not caught by other rules)
        tokenValue = stream.next(); // Consume the unknown character
        tokens.push({ type: TOKEN_TYPES.UNKNOWN, value: tokenValue, line: startLocation.line, column: startLocation.column, originalLength: 1 });
    }

    const eofLocation = stream.getCurrentLocation();
    tokens.push({ type: TOKEN_TYPES.EOF, value: null, line: eofLocation.line, column: eofLocation.column, originalLength: 0 });
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
