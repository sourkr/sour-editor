# Sour Language Documentation

Sour Language is a simple, interpreted programming language. It is designed for educational purposes and to demonstrate basic language parsing and interpretation concepts.

## Core Concepts

- **Keywords**: `print`
- **Functions**: `_stdout` (for character output)
- **Data Types**: Currently supports strings and characters.

## Syntax

### Printing to Console

To print a string to the console:

```sour
print "Hello, World!"
```

### Character Output

To print a single character to standard output (e.g., for building strings character by character):

```sour
_stdout('A')
```

### Comments

Sour Language does not currently support comments.

## Error Handling

The interpreter provides basic error messages for syntax and type errors.

## Extending the Language

- **Parser**: `libs/sourlang/parser.js` handles the syntax analysis.
- **Validator**: `libs/sourlang/validator.js` performs semantic checks and type validation.
- **Interpreter**: `libs/sourlang/interpreter.js` executes the abstract syntax tree (AST).
- **Tokens**: `libs/sourlang/tokens.js` defines the language's tokens.
- **Chars**: `libs/sourlang/chars.js` defines character-related utilities.
