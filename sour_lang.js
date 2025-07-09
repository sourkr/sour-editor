// sour_lang.js - Main thread part (now very minimal)

const SourLang = (() => {

    // TOKEN_TYPES are primarily used by the worker and for highlighting on the main thread.
    const TOKEN_TYPES = {
        PRINT: 'PRINT',
        STRING: 'STRING',
        NEWLINE: 'NEWLINE',
        WHITESPACE: 'WHITESPACE',
        EOF: 'EOF',
        UNKNOWN: 'UNKNOWN'
    };

    // AST_NODE_TYPES are primarily used by the worker (parser & interpreter).
    // Kept here if any main thread logic might need to inspect AST types, unlikely for now.
    const AST_NODE_TYPES = {
        PROGRAM: 'Program',
        PRINT_STATEMENT: 'PrintStatement',
        STRING_LITERAL: 'StringLiteral'
    };

    // Interpreter logic has been moved to sour_worker.js
    // The `execute` function here is effectively removed as execution is initiated via worker.
    // If there was a need for main-thread only SourLang utilities, they would go here.

    const SourLangObject = {
        // No execute method here anymore.
        TOKEN_TYPES,    // Still needed by main.js for updateHighlighting
        AST_NODE_TYPES  // Potentially useful, but not strictly needed by main.js currently
    };

    return SourLangObject;

})();

export { SourLang };
