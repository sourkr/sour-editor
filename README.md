# Sour Editor - Mobile JavaScript IDE

Sour Editor is a lightweight, mobile-first JavaScript IDE that runs directly in your browser. It's designed for quick coding sessions, experimentation, and learning on the go. All files are stored locally in your browser's localStorage.

## Features

*   **Code Editor**: A simple textarea-based editor for writing JavaScript.
*   **JavaScript Execution**: Run your JavaScript code and see the output or errors directly within the app.
    *   Captures `console.log()` calls.
    *   Displays return values of executed code.
*   **File System (localStorage-based)**:
    *   Create, save, load, and delete files.
    *   Organize files into folders (e.g., `folderName/fileName.js`).
    *   File tree navigation drawer.
*   **Context Menu (Mobile Focused)**:
    *   Press and hold on a folder (including the root) in the file tree to open a context menu.
    *   **Create File**: Allows creating a new file directly within the selected folder.
*   **Custom Font**: Uses `zed-mono-extended.ttf` for a consistent coding aesthetic.
*   **Action Bar**:
    *   Toggle file tree visibility.
    *   Clear output.
    *   Copy code to clipboard.
    *   Toggle text wrapping in the editor.
*   **Responsive Design**: Aimed primarily at mobile use but functional on desktop.

## How to Use

1.  **Open `index.html`**: Simply open the `index.html` file in a modern web browser.
2.  **File Management**:
    *   Use the file tree (toggle with the menu icon) to manage your files.
    *   To create a new file in the root directory or a specific folder:
        *   Press and hold the desired folder name (e.g., `/` for root, or any other folder) in the file tree.
        *   Select "Create File" from the context menu that appears.
        *   Enter the file name (e.g., `myScript.js` or `utils/helper.js`).
    *   Alternatively, use the input field and buttons at the top of the file tree for creating, saving, and deleting files based on the name in the input.
    *   Click on a file in the list to load it into the editor.
3.  **Coding**:
    *   Write your JavaScript code in the editor area.
    *   Click "Run Code" to execute it.
    *   View results or errors in the output panel below the editor.
4.  **Toolbar Actions**:
    *   Use the buttons in the top action bar for quick actions like toggling the file tree, clearing output, copying code, and toggling text wrap.

## Technical Details

*   **Frontend**: HTML, CSS, JavaScript.
*   **Storage**: Browser localStorage is used to save and manage files. This means files are stored per browser and per domain.
*   **Font**: `zed-mono-extended.ttf` is included for code presentation.

## Development

To modify or extend Sour Editor:

1.  Clone or download the repository.
2.  Edit `index.html`, `style.css`, and `script.js` as needed.
3.  Test your changes by opening `index.html` in your browser.

No build process is currently required.

## License

This project is licensed under the [MIT License](LICENSE). (Assuming MIT, please update if different).
