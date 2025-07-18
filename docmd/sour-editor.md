# Sour Editor Documentation

This document provides an overview of the Sour Editor, a lightweight code editor designed for simplicity and efficiency.

## Features

- **File Management**: Create, save, load, and delete files using `localStorage`. Supports multiple open files in tabs.
- **Run Code**: Execute Sour Language code directly within the editor and view output in a dedicated console.
- **Enhanced Syntax Highlighting**: Supports syntax highlighting for Sour Language files, including bracket matching (with depth-based coloring) and current line highlighting.
- **Autocompletion**: Provides intelligent code completion suggestions for keywords and functions, including function signatures.
- **Error Tooltips**: Displays detailed error messages directly in the editor for easy debugging.
- **Documentation Tooltips**: Shows documentation for autocompletion suggestions, such as function parameters and return types.

## Usage

- **File Operations**: Use the file tree to create, open, and manage your Sour Language files.
- **Editing Code**: Type your Sour Language code directly into the editor.
- **Running Code**: Click the "Run" button to execute your code. Output and errors will appear in the "Output" tab.
- **Autocompletion**: Suggestions will appear as you type. Use arrow keys to navigate and Enter to select.
- **Error Guidance**: Error tooltips will guide you in fixing syntax issues.

## Customization

The editor's appearance can be customized via `style.css`.

## Development

The core logic for the editor is found in `main.js` and `libs/ui/editor.js`.
