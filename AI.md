# AI Development Guide for Sour Editor

This document provides instructions for AI agents to understand and contribute to the Sour Editor project.

## Project Overview

Sour Editor is a lightweight, mobile-first JavaScript IDE that runs in the browser. It uses `localStorage` for file storage. The primary goal is to provide a simple coding environment for mobile devices.

## Core Technologies

*   **Frontend**: HTML, CSS, vanilla JavaScript (ES Modules).
*   **Storage**: Browser `localStorage`.
*   **Custom Language**: "Sour Lang", a simple language being developed as part of this project.

## File Structure

*   `index.html`: The main entry point of the application.
*   `style.css`: All styles for the application.
*   `main.js`: The main application logic, event handling, and coordination between modules.
*   `filetree.js`: Manages the file system view and operations (create, save, load, delete) using `localStorage`.
*   `libs/spannable-text.js`: A library for creating text with spans, used for syntax highlighting.
*   `libs/ui.js`: A library for UI components.
*   `libs/sourlang/`: Directory for the Sour Lang implementation.
    *   `base.js`: Base classes and constants for the language.
    *   `chars.js`: Character stream helper for the parser.
    *   `interpreter.js`: The Sour Lang interpreter.
    *   `parser.js`: The Sour Lang parser.
    *   `tokens.js`: The Sour Lang tokenizer (lexer).
*   `icon/`: SVG icons used in the UI.
*   `zed-mono-extended.ttf`: The font used in the editor.

## How to Work with the Code

### Running the Application

1.  There is no build step.
2.  Open `index.html` in a web browser to run the application.

### Making Changes

1.  **Editing Code**: Modify the relevant HTML, CSS, or JavaScript files.
2.  **Testing**: Reload `index.html` in the browser to see your changes.
3.  **Dependencies**: All dependencies are included in the repository. No package manager is used.

### Sour Lang

Sour Lang is a custom language being built for this editor.

*   **Current Status (Phase 1)**: It supports `print "string"` statements.
*   **Implementation**:
    *   The language processing (lexing, parsing, interpreting) is handled in the `libs/sourlang/` directory.
    *   `tokens.js` performs lexical analysis (tokenization).
    *   `parser.js` builds an Abstract Syntax Tree (AST) from the tokens.
    *   `interpreter.js` executes the AST.
*   **Execution Flow**:
    1.  User writes Sour Lang code in the editor.
    2.  User clicks the "Run Sour Code" button.
    3.  The code from the editor is sent to the interpreter.
    4.  The output is displayed in a panel below the editor.
*   **Syntax Highlighting**:
    *   `libs/spannable-text.js` is used to apply syntax highlighting for keywords and strings.
    *   Highlighting is updated as the user types.

## Contribution Guidelines

*   **Style**: Follow the existing code style.
*   **Modularity**: Keep code in separate modules as is currently done.
*   **No External Libraries**: Do not add external libraries or dependencies without a strong reason. The goal is to keep the project lightweight.
*   **Focus**: The primary focus is on improving the mobile coding experience.
