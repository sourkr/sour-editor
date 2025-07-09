# Sour Editor - Mobile JavaScript IDE

Sour Editor is a lightweight, mobile-first JavaScript IDE that runs directly in your browser. It's designed for quick coding sessions, experimentation, and learning on the go. All files are stored locally in your browser's localStorage.

## Features

*   **Code Editor**: A simple textarea-based editor for writing code.
*   **Sour Lang (Experimental - Phase 1)**:
    *   Basic custom language support with syntax highlighting.
    *   Highlights `print` keyword and string literals.
    *   Current capability: `print "string"` statements.
    *   Live error reporting (as you type, after a short delay):
        *   For smaller files (under ~2000 characters), the first detected syntax error is indicated with a red dotted underline as you type.
        *   For larger files, live error underlining is paused to maintain performance; errors are shown after clicking "Run Sour Code".
        *   Press `Ctrl+I` (or `Cmd+I` on Mac) to view the details of the latest error relevant to the current context (live for small files, post-execution for large files).
    *   Execution via "Run Sour Code" button in the action bar (provides definitive error checking and output for all file sizes).
    *   Output displayed in a dedicated panel below the editor.
*   **File System (localStorage-based)**:
    *   Create, save, load, and delete files (e.g., `.txt`, `.js`, `.sour`).
    *   Organize files into folders (e.g., `folderName/fileName.js`).
    *   File tree navigation drawer.
*   **Context Menu (Mobile Focused)**:
    *   Press and hold on a folder (including the root) in the file tree to open a context menu.
    *   **Create File**: Allows creating a new file directly within the selected folder.
*   **Custom Font**: Uses `zed-mono-extended.ttf` for a consistent coding aesthetic.
*   **Action Bar**:
    *   Toggle file tree visibility.
    *   **Save File**: Save the currently active file.
    *   **Run Sour Code**: Execute code written in Sour Lang from the editor.
*   **Responsive Design**: Aimed primarily at mobile use but functional on desktop.

## How to Use

1.  **Open `index.html`**: Simply open the `index.html` file in a modern web browser.
2.  **File Management**:
    *   Use the file tree (toggle with the menu icon on the left of the action bar) to manage your files.
    *   To create a new file in the root directory or a specific folder:
        *   Press and hold the desired folder name (e.g., `/` for root, or any other folder) in the file tree.
        *   Select "Create File" from the context menu that appears.
        *   Enter the file name (e.g., `myScript.js` or `docs/notes.txt`). This is the primary way to create new files.
    *   Click on a file in the list within the file tree drawer to load it into the editor.
3.  **Coding**:
    *   Write your code in the editor area. You can save any text-based file (e.g., `myCode.js`, `notes.txt`, `hello.sour`).
    *   Use the **Save icon** in the action bar (top right) to save your work for the currently active file.
4.  **Running Sour Lang Code**:
    *   Write your Sour Lang code in the editor. For Phase 1, this is limited to `print "your string"` statements. For example:
        ```sour
        print "Hello from Sour Lang!"
        print "This is a second line."
        ```
    *   For smaller files, syntax errors in Sour Lang code will be underlined with a red dotted line as you type (after a brief pause).
    *   For larger files, this live underlining is paused for performance; errors will be shown after you click the "Run Sour Code" button.
    *   Press `Ctrl+I` (or `Cmd+I` on Mac) at any time to see details about the currently detected syntax error (if any relevant to the last check).
    *   Click the **Play icon** (Run Sour Code) in the action bar to execute the code. This will always perform a full error check and display output (or errors) in the panel below the editor.
5.  **Toolbar Actions**:
    *   **Menu Icon (Left)**: Toggles the file tree visibility.
    *   **Save Icon (Middle-Right)**: Saves the current file.
    *   **Play Icon (Right)**: Executes the Sour Lang code in the editor.

## Technical Details

*   **Frontend**: HTML, CSS, JavaScript (using ES Modules).
*   **Storage**: Browser localStorage is used to save and manage files. This means files are stored per browser and per domain.
*   **Font**: `zed-mono-extended.ttf` is included for code presentation.
*   **Sour Lang**:
    *   Interpreter (Lexer, Parser, Interpreter for `print "string"`) in `sour_lang.js`.
    *   Basic syntax highlighting for keywords and strings in the editor.
*   **Scripts**: `script.js` and `sour_lang.js` are loaded as ES Modules.

## Development

To modify or extend Sour Editor:

1.  Clone or download the repository.
2.  Edit `index.html`, `style.css`, and `script.js` as needed.
3.  Test your changes by opening `index.html` in your browser.

No build process is currently required.

## License

This project is licensed under the [MIT License](LICENSE). (Assuming MIT, please update if different).
