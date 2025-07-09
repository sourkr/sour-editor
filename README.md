# Sour Editor - Mobile JavaScript IDE

Sour Editor is a lightweight, mobile-first JavaScript IDE that runs directly in your browser. It's designed for quick coding sessions, experimentation, and learning on the go. All files are stored locally in your browser's localStorage.

## Features

*   **Code Editor**: A simple textarea-based editor for writing code.
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
    *   **Save File**: Save the currently active file.
*   **Responsive Design**: Aimed primarily at mobile use but functional on desktop.

## How to Use

1.  **Open `index.html`**: Simply open the `index.html` file in a modern web browser.
2.  **File Management**:
    *   Use the file tree (toggle with the menu icon on the left of the action bar) to manage your files.
    *   To create a new file in the root directory or a specific folder:
        *   Press and hold the desired folder name (e.g., `/` for root, or any other folder) in the file tree.
        *   Select "Create File" from the context menu that appears.
        *   Enter the file name (e.g., `myScript.js` or `docs/notes.txt`).
    *   The file input and associated action buttons (New, Save, Delete) are located at the top of the file tree drawer.
    *   Click on a file in the list to load it into the editor.
3.  **Coding**:
    *   Write your code in the editor area.
    *   Use the **Save icon** in the action bar (top right) or the "Save File" button in the file tree drawer to save your work.
4.  **Toolbar Actions**:
    *   **Menu Icon (Left)**: Toggles the file tree visibility.
    *   **Save Icon (Right)**: Saves the current file.

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
