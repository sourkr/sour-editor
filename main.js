const codeEditor = document.getElementById('code-editor');
// const runButton = document.getElementById('run-button'); // Removed
// const outputContainer = document.getElementById('output-container'); // Removed
// Action Bar Buttons
const toggleFileTreeButton = document.getElementById('toggle-file-tree-button');
const actionBarSaveButton = document.getElementById('action-bar-save-button'); // Added
// const clearOutputButton = document.getElementById('clear-output-button'); // Removed
// const copyCodeButton = document.getElementById('copy-code-button'); // Removed
// const toggleWrapButton = document.getElementById('toggle-wrap-button'); // Removed
// File System Elements
const fileSystemContainer = document.getElementById('file-system-container');
// const fileNameInput = document.getElementById('file-name-input'); // Removed
// const newFileButton = document.getElementById('new-file-button'); // Removed
// const saveFileButton = document.getElementById('save-file-button'); // Removed
// const deleteFileButton = document.getElementById('delete-file-button'); // Removed
const fileListContainer = document.getElementById('file-list');

// Sour Lang specific elements
const runSourButton = document.getElementById('run-sour-button');
const sourOutputContainer = document.getElementById('sour-output-container');

// Import SourLang
import { SourLang } from './sour_lang.js';
// Import File Manager
import { getFileStorageKey, getSavedFiles, saveFileToStorage, loadFileFromStorage, deleteFileFromStorage } from './file_manager.js';

// --- Helper Functions ---
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Syntax Highlighting Elements
const highlightingArea = document.getElementById('highlighting-area');
const highlightingLayer = document.getElementById('highlighting-layer');

let sourSyntaxError = null;
let lastValidAST = null; // To store the last valid AST received from the worker
const sourWorker = new Worker('./sour_worker.js');

let activeFileName = null;
// const localStorageKeyPrefix = 'jsIDE_file_'; // Moved to file_manager.js

// --- Core IDE Functionality ---

// Run Code Button - REMOVED
// Clear Output Button - REMOVED
// Copy Code Button - REMOVED
// Toggle Text Wrap Button - REMOVED

// --- File System Logic (UI and Orchestration part) ---
// Actual storage interaction is in file_manager.js

// function getFileStorageKey(fileName) { // Moved to file_manager.js
//     return localStorageKeyPrefix + fileName;
// }

// function getSavedFiles() { // Moved to file_manager.js
//     const files = [];
//     for (let i = 0; i < localStorage.length; i++) {
//         const key = localStorage.key(i);
//         if (key.startsWith(localStorageKeyPrefix)) {
//             files.push(key.substring(localStorageKeyPrefix.length));
//         }
//     }
//     return files.sort();
// }

function displayFiles() {
    fileListContainer.innerHTML = ''; // Clear current list
    const files = getSavedFiles(); // These are full paths, e.g., "folder/file.js" or "file.js"

    // Initialize fileTree with a root folder '/'
    const fileTree = { '/': [] };

    files.forEach(fullPath => {
        const parts = fullPath.split('/');
        if (parts.length > 1 && parts[0] !== '') { // Ensure folder name is not empty
            const folderName = parts[0];
            const fileName = parts.slice(1).join('/');
            if (!fileTree[folderName]) {
                fileTree[folderName] = [];
            }
            fileTree[folderName].push(fileName);
        } else {
            // Files like "file.js" or "/file.js" (if user types it) go to root '/'
            fileTree['/'].push(fullPath.startsWith('/') ? fullPath.substring(1) : fullPath);
        }
    });

    // Get all folder names, ensure '/' is first if present, then sort others
    let folderNames = Object.keys(fileTree);
    if (fileTree['/'] && fileTree['/'].length === 0 && folderNames.length > 1) {
        // If root is empty and there are other folders, maybe don't show it unless it's the *only* thing
        // For now, always show '/' if it exists (it always will due to initialization)
    }

    folderNames = folderNames.sort((a, b) => {
        if (a === '/') return -1; // '/' always first
        if (b === '/') return 1;  // '/' always first
        return a.localeCompare(b); // बाकी सब बाद में
    });

    folderNames.forEach(folderName => {
        // Skip empty folders unless it's the root folder (which might be empty)
        if (folderName !== '/' && fileTree[folderName].length === 0) {
            return;
        }

        const folderContainer = document.createElement('div');
        folderContainer.classList.add('folder-entry');

        // Special handling for root display name if preferred, but folderName is '/'
        // const displayFolderName = (folderName === '/') ? 'Root' : folderName;

        const folderHeader = document.createElement('div');
        folderHeader.classList.add('folder-header');
        // Add data attributes for context menu
        folderHeader.dataset.folderPath = folderName === '/' ? '/' : `${folderName}/`;
        folderHeader.dataset.isRoot = (folderName === '/').toString();


        const folderIcon = document.createElement('span');
        folderIcon.classList.add('material-symbols-rounded', 'folder-icon');
        folderIcon.textContent = 'folder'; // Default icon
        folderHeader.appendChild(folderIcon);

        const folderNameSpan = document.createElement('span');
        folderNameSpan.textContent = folderName;
        folderNameSpan.classList.add('folder-name');
        folderHeader.appendChild(folderNameSpan);
        folderContainer.appendChild(folderHeader);

        const filesInFolderDiv = document.createElement('div');
        filesInFolderDiv.classList.add('files-in-folder');

        fileTree[folderName].sort().forEach(fileNameInFolder => {
            // If folderName is '/', fileNameInFolder is already the full path for root files.
            // Otherwise, construct fullPath.
            const fullPath = (folderName === '/') ? fileNameInFolder : `${folderName}/${fileNameInFolder}`;

            const fileEntry = document.createElement('div');
            fileEntry.classList.add('file-entry');
            // For root files under '/', fileNameInFolder is the full path. For others, it's the relative path.
            fileEntry.textContent = (folderName === '/') ? fullPath : fileNameInFolder;
            fileEntry.dataset.fullPath = fullPath;

            if (fullPath === activeFileName) {
                fileEntry.classList.add('active-file');
            }
            fileEntry.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent folder click event
                loadFile(fullPath);
            });
            filesInFolderDiv.appendChild(fileEntry);
        });
        folderContainer.appendChild(filesInFolderDiv);

        // Basic expand/collapse
        folderHeader.addEventListener('click', () => {
            const isOpen = filesInFolderDiv.style.display !== 'none';
            filesInFolderDiv.style.display = isOpen ? 'none' : 'block';
            folderContainer.classList.toggle('open', !isOpen);
            folderIcon.textContent = isOpen ? 'folder' : 'folder_open';
        });

        // Check if active file is in this folder to auto-expand and set icon
        let shouldBeOpen = false;
        if (folderName === '/') {
            // Open root if active file is a root file (no slash in its name after initial possible slash)
            // and activeFileName itself is not null or just "/"
            shouldBeOpen = activeFileName && activeFileName.indexOf('/') === -1 && activeFileName !== '';
             if (!activeFileName && fileTree['/'].length > 0) { // If no active file, but root has files, open root by default
                // shouldBeOpen = true; // User feedback might prefer this default to closed
             }
        } else {
            // Open folder if active file is within this folder
            shouldBeOpen = activeFileName && activeFileName.startsWith(folderName + '/');
        }

        if (shouldBeOpen) {
            filesInFolderDiv.style.display = 'block';
            folderContainer.classList.add('open');
            folderIcon.textContent = 'folder_open';
        } else {
            filesInFolderDiv.style.display = 'none';
            folderIcon.textContent = 'folder';
        }
        fileListContainer.appendChild(folderContainer);
    });
    // The _root_ loop is no longer needed as root files are handled by the '/' folder.
}

// Renamed to reflect it's the UI-facing save operation
function saveActiveFile(fileName, content) {
    if (!fileName || fileName.trim() === '') {
        alert('Please enter a valid file name.'); // This alert can stay here as it's UI feedback
        return false;
    }
    if (saveFileToStorage(fileName.trim(), content)) {
        activeFileName = fileName.trim();
        displayFiles(); // Refresh file list after successful save
        return true;
    }
    return false; // Should not happen if fileName is valid, but as a fallback
}

// Renamed to reflect it's the UI-facing load operation
function loadFileToEditor(fileName) {
    const content = loadFileFromStorage(fileName);
    if (content !== null) {
        codeEditor.value = content;
        activeFileName = fileName;

        // Update active class in file list
        const currentActive = fileListContainer.querySelector('.active-file');
        if (currentActive) {
            currentActive.classList.remove('active-file');
        }

        const newActiveEntry = Array.from(fileListContainer.querySelectorAll('.file-entry'))
                               .find(child => child.dataset.fullPath === fileName);
        if (newActiveEntry) {
            newActiveEntry.classList.add('active-file');
            // Also ensure its parent folder is open if it's in a folder
            const parentFolderFilesDiv = newActiveEntry.closest('.files-in-folder');
            if (parentFolderFilesDiv) { // It's inside a folder structure
                const folderEntryDiv = parentFolderFilesDiv.closest('.folder-entry');
                if (parentFolderFilesDiv.style.display === 'none') {
                    parentFolderFilesDiv.style.display = 'block';
                    if (folderEntryDiv) {
                        folderEntryDiv.classList.add('open');
                        const icon = folderEntryDiv.querySelector('.folder-icon');
                        if (icon) icon.textContent = 'folder_open';
                    }
                } else { // If folder was already open, still ensure icon is correct
                     if (folderEntryDiv) {
                        const icon = folderEntryDiv.querySelector('.folder-icon');
                        if (icon && folderEntryDiv.classList.contains('open')) icon.textContent = 'folder_open';
                     }
                }
            }
        }
    } else {
        alert(`File "${fileName}" not found.`);
    }
    // Ensure highlighting is updated after loading a file
    updateHighlighting();
}

// Renamed to reflect it's the UI-facing delete operation
function deleteActiveFile(fileName) {
    if (!fileName || fileName.trim() === '') {
        alert('No file selected or name provided to delete.'); // UI feedback
        return;
    }
    if (confirm(`Are you sure you want to delete "${fileName.trim()}"?`)) { // UI feedback
        deleteFileFromStorage(fileName.trim());
        if (activeFileName === fileName.trim()) {
            activeFileName = null;
            codeEditor.value = ''; // Clear editor
            updateHighlighting(); // Clear highlighting too
        }
        displayFiles(); // Refresh file list
    }
}

// function handleNewFile() { // REMOVED as its button is gone. Context menu handles new file creation.
//     const newName = fileNameInput.value.trim();
//     if (!newName) {
//         alert("Please enter a name for the new file.");
//         return;
//     }
//     if (getSavedFiles().includes(newName)) {
//         if (!confirm(`File "${newName}" already exists. Overwrite it or load it? Press OK to load, Cancel to keep editing name.`)) {
//             fileNameInput.focus();
//             return;
//         }
//         loadFile(newName); // Load existing if user confirms
//     } else {
//         // Create a new empty file conceptually
//         codeEditor.value = '';
//         activeFileName = newName;
//         // No need to save an empty file to localStorage immediately,
//         // let the user type and then save.
//         // But we should reflect it in the input and potentially list (if we want to show "new unsaved" files)
//         // For now, just set activeFileName and clear editor. Save will persist.
//         // fileNameInput.value = activeFileName; // REMOVED
//         // Remove active class from others
//         const currentActive = fileListContainer.querySelector('.active-file');
//         if (currentActive) {
//             currentActive.classList.remove('active-file');
//         }
//         // It won't be in the list until saved, so displayFiles() won't mark it yet.
//         // We could add a temporary "new file" visual cue if desired.
//         alert(`New file "${newName}" ready. Type your code and click Save.`);
//     }
// }

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    displayFiles();
    // Optionally, load the first file or a last opened file
    // const files = getSavedFiles();
    // if (files.length > 0) {
    //     loadFile(files[0]);
    // }
    // fileSystemContainer.style.display = 'none'; // No longer needed, drawer is positioned off-screen by default
    initializeContextMenu();
});

// --- Context Menu Logic ---
let contextMenuTimeout;
const CONTEXT_MENU_HOLD_DURATION = 700; // ms

function showContextMenu(x, y, targetElement) {
    // Remove existing context menu if any
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Check if the target is the root folder or a specific folder
    const isRootFolder = targetElement.dataset.isRoot === 'true';
    const folderPath = targetElement.dataset.folderPath; // Will be '/' for root or 'folderName/'

    const createFileOption = document.createElement('div');
    createFileOption.textContent = 'Create File';
    createFileOption.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        const newFileName = prompt(`Enter name for new file in ${folderPath === '/' ? 'root' : folderPath}:`);
        if (newFileName && newFileName.trim() !== '') {
            const fullPath = folderPath === '/' ? newFileName.trim() : `${folderPath}${newFileName.trim()}`;
            // Check if file already exists
            if (getSavedFiles().includes(fullPath)) { // getSavedFiles is from file_manager.js
                alert(`File "${fullPath}" already exists.`);
            } else {
                codeEditor.value = '';
                activeFileName = fullPath;
                saveActiveFile(activeFileName, ''); // Use the new UI-facing save function
                // displayFiles() is called by saveActiveFile
                alert(`File "${fullPath}" created.`);
                updateHighlighting(); // Update for empty content
            }
        }
    });
    menu.appendChild(createFileOption);

    // Add more options as needed, e.g., "Create Folder", "Rename", "Delete" for specific items

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => { // Add to event queue to prevent immediate closing
        document.addEventListener('click', function closeMenuOnClickOutside(event) {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenuOnClickOutside);
            }
        }, { once: true }); // Use once: true for self-removing listener
    }, 0);
}

function initializeContextMenu() {
    // Listener for file list container to handle long press on folder items
    fileListContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    fileListContainer.addEventListener('touchend', handleTouchEnd);
    fileListContainer.addEventListener('contextmenu', handleContextMenu); // For desktop testing
}

function handleTouchStart(event) {
    const targetFolderHeader = event.target.closest('.folder-header');
    if (targetFolderHeader) {
        clearTimeout(contextMenuTimeout); // Clear any existing timeout
        contextMenuTimeout = setTimeout(() => {
            event.preventDefault(); // Prevent default touch behavior like scrolling
            // For touch, clientX/Y might not be what we want, pageX/Y is better
            showContextMenu(event.touches[0].pageX, event.touches[0].pageY, targetFolderHeader);
        }, CONTEXT_MENU_HOLD_DURATION);
    }
}

function handleTouchEnd(event) {
    clearTimeout(contextMenuTimeout);
    // If it was a short tap, the folder click handler will manage expand/collapse
}

function handleContextMenu(event) { // For desktop right-click
    const targetFolderHeader = event.target.closest('.folder-header');
    if (targetFolderHeader) {
        event.preventDefault(); // Prevent native context menu
        showContextMenu(event.pageX, event.pageY, targetFolderHeader);
    }
}


// --- File Tree Toggle ---
toggleFileTreeButton.addEventListener('click', () => {
    fileSystemContainer.classList.toggle('open');
    if (fileSystemContainer.classList.contains('open')) {
        toggleFileTreeButton.title = 'Hide File Tree';
        // Optional: Change icon to 'close'
        // toggleFileTreeButton.querySelector('.material-symbols-rounded').textContent = 'close';
    } else {
        toggleFileTreeButton.title = 'Show File Tree';
        // Optional: Change icon back to 'menu'
        // toggleFileTreeButton.querySelector('.material-symbols-rounded').textContent = 'menu';
    }
});

// --- Connect File System UI to Logic ---
// newFileButton.addEventListener('click', handleNewFile); // REMOVED
// saveFileButton.addEventListener('click', () => { // REMOVED
//     const fileName = fileNameInput.value.trim() || activeFileName;
//     if (!fileName) {
//         alert("Please enter a file name or select an existing file to save.");
//         fileNameInput.focus();
//         return;
//     }
//     saveFile(fileName, codeEditor.value);
// });
// deleteFileButton.addEventListener('click', () => { // REMOVED
//     const fileNameToDelete = fileNameInput.value.trim() || activeFileName;
//     if (!fileNameToDelete) {
//         alert("Please enter a file name or select a file from the list to delete.");
//         return;
//     }
//     deleteFile(fileNameToDelete);
// });

// Ensure fileNameInput updates activeFileName if user types and blurs, // REMOVED
// but only if it's not already an existing file (to avoid accidental overwrite intent)
// This might be too complex for now; primary interaction is via buttons and list.
// For now, fileNameInput primarily serves to name new files or specify for deletion if not selected.

// Action Bar Save Button
actionBarSaveButton.addEventListener('click', () => {
    const fileName = activeFileName; // fileNameInput.value.trim() fallback removed
    if (!fileName) {
        alert("No active file selected to save. Please open a file or create a new one via the context menu.");
        return;
    }
    if (saveActiveFile(fileName, codeEditor.value)) { // Use the new UI-facing save function
        // Optional: Show a temporary message like "File saved!"
        const originalText = actionBarSaveButton.querySelector('.material-symbols-rounded').textContent;
        const originalTitle = actionBarSaveButton.title;
        actionBarSaveButton.querySelector('.material-symbols-rounded').textContent = 'check';
        actionBarSaveButton.title = 'Saved!';
        setTimeout(() => {
            actionBarSaveButton.querySelector('.material-symbols-rounded').textContent = originalText;
            actionBarSaveButton.title = originalTitle;
        }, 1500);
    }
});

// Sour Lang Run Button
if (runSourButton) {
    runSourButton.addEventListener('click', () => {
        const code = codeEditor.value;
        // Option A: Use lastValidAST if available and code hasn't changed
        // This requires comparing codeEditor.value with code that produced lastValidAST.
        // For simplicity now, always re-process via worker for "Run" button.
        // This ensures the very latest code is executed and errors checked.

        // Send to worker for fresh parse and AST, then execute.
        // We need a way to know this specific worker message is for a "Run" action.
        sourWorker.postMessage({ code: code, action: 'execute' });

        // The actual execution (SourLang.execute(ast)) will happen in the worker's onmessage,
        // or main thread needs to get AST from worker then call SourLang.execute(ast).
        // For now, let's assume worker's onmessage will handle 'execute' action differently,
        // perhaps by also running the interpreter if AST is valid.
        // This part needs to be coordinated with sour_worker.js message handling.

        // TEMPORARY: For now, "Run" button will just re-trigger the parse/highlight flow.
        // The interpreter part needs more thought on where it runs.
        // If interpreter stays on main thread:
        // 1. Worker sends back AST.
        // 2. `main.js` onmessage receives AST.
        // 3. If "Run" was clicked, `main.js` calls `SourLang.execute(receivedAST)`.

        // For this iteration, let's simplify: "Run" button ensures errors are up-to-date
        // and output is based on the latest `lastValidAST` if available.
        // The worker will always send back tokens, ast, error.
        // `main.js` will update `sourSyntaxError` and `lastValidAST`.
        // Then, here, we use `lastValidAST`.

        if (sourSyntaxError) { // If live parsing already found an error
            sourOutputContainer.textContent = `Error (L${sourSyntaxError.line}:${sourSyntaxError.column}): ${sourSyntaxError.message}`;
            sourOutputContainer.style.color = 'red';
        } else if (lastValidAST) {
            const result = SourLang.execute(lastValidAST); // SourLang.execute now takes an AST
            if (result.error) { // This would be an interpreter error
                sourOutputContainer.textContent = `Runtime Error: ${result.error.message || JSON.stringify(result.error)}`;
                sourOutputContainer.style.color = 'red';
                 // sourSyntaxError might not be relevant for runtime errors, but clear it from parse phase
                sourSyntaxError = null;
            } else {
                sourOutputContainer.textContent = result.output;
                sourOutputContainer.style.color = '';
                sourSyntaxError = null;
            }
        } else {
            // No valid AST and no syntax error from live check - means code is likely empty or too large for live check
            // Or worker hasn't responded yet. For "Run", we should ideally wait for worker.
            // This simplified version might show "No AST" if worker is slow and run is clicked fast.
            sourOutputContainer.textContent = "No valid program to run. Type some code or ensure it has no syntax errors.";
            sourOutputContainer.style.color = 'orange';
        }
        // Send current code to worker to ensure `lastValidAST` and `sourSyntaxError` are up-to-date.
        // The worker's onmessage handler will update these.
        sourWorker.postMessage({ code: code, action: 'process_for_execute' }); // action can be used by worker if needed

        // After the worker responds (asynchronously), lastValidAST and sourSyntaxError will be set.
        // We can then attempt to execute. This might mean the output is slightly delayed.
        // A more advanced version could use a Promise or callback from the worker for this specific "run" action.

        // For now, we'll assume the onmessage handler updates lastValidAST and sourSyntaxError quickly enough
        // or the user understands there might be a slight delay.
        // The actual interpretation logic based on lastValidAST:

        // We need to make sure this part runs *after* the worker has responded to the 'process_for_execute' message.
        // This is tricky without a callback/promise system from the worker for specific actions.
        // Let's defer the execution part to the onmessage handler for 'process_for_execute' actions.

        // Simplification for now: The click primarily ensures the latest code is sent to the worker.
        // The user will see the output based on the *next* processing cycle of the worker
        // which updates lastValidAST. The Sour Output container will show the result of interpreting
        // the `lastValidAST` available at the time of the worker's LATEST response.

        // So, the button click just triggers a new processing round.
        // The actual execution logic will be slightly refactored into the worker's onmessage for an 'execute' action.

        // The worker will process this, run the interpreter, and send back all results
        // including interpreterOutput or runtimeError.
        // The sourWorker.onmessage handler will update the sourOutputContainer.
        if (sourWorker) {
            sourWorker.postMessage({ code: code, action: 'execute' });
        } else {
            sourOutputContainer.textContent = "Error: Sour Worker not available.";
            sourOutputContainer.style.color = 'red';
        }
    });
}

// --- Syntax Highlighting Logic ---
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// updateHighlighting now accepts the code string and tokens as arguments
function updateHighlighting(currentCode, tokensToHighlight) {
    if (!codeEditor || !highlightingLayer || !SourLang || !SourLang.TOKEN_TYPES) {
        return;
    }

    const htmlParts = [];

    if (!tokensToHighlight || !Array.isArray(tokensToHighlight)) {
        // If no tokens passed, or invalid, render the current code as plain text (escaped).
        // This might happen if the worker fails or before the first response.
        highlightingLayer.innerHTML = escapeHtml(currentCode);
        return;
    }

    tokensToHighlight.forEach(token => {
        const value = escapeHtml(token.value);
        let classList = '';
        let isErrorToken = false;

        if (sourSyntaxError &&
            token.line === sourSyntaxError.line &&
            token.column === sourSyntaxError.column &&
            token.originalLength > 0) {
            isErrorToken = true;
        }

        switch (token.type) {
            case SourLang.TOKEN_TYPES.PRINT:
                classList = 'sour-keyword';
                if (isErrorToken) classList += ' sour-error-segment';
                htmlParts.push(`<span class="${classList}">${value}</span>`);
                break;
            case SourLang.TOKEN_TYPES.STRING:
                classList = 'sour-string';
                if (isErrorToken) classList += ' sour-error-segment';
                htmlParts.push(`<span class="${classList}">"${value}"</span>`);
                break;
            case SourLang.TOKEN_TYPES.NEWLINE:
                htmlParts.push('\n');
                break;
            case SourLang.TOKEN_TYPES.WHITESPACE:
                if (isErrorToken) {
                    htmlParts.push(`<span class="sour-error-segment">${value}</span>`);
                } else {
                    htmlParts.push(value);
                }
                break;
            case SourLang.TOKEN_TYPES.EOF:
                break;
            default: // UNKNOWN tokens
                if (isErrorToken) {
                     htmlParts.push(`<span class="sour-error-segment">${value}</span>`);
                } else {
                    htmlParts.push(value);
                }
                break;
        }
    });

    let finalHtml = htmlParts.join('');
    // Use currentCode (passed as argument) for this check
    if (currentCode.endsWith('\n') && !finalHtml.endsWith('\n')) {
        finalHtml += '\n';
    }

    highlightingLayer.innerHTML = finalHtml;

    // Synchronize scroll
    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}


if (codeEditor) {
    const LIVE_ERROR_CHECK_THRESHOLD = 2000; // Max characters for live error parsing

    // const LIVE_ERROR_CHECK_THRESHOLD = 2000; // Threshold logic might be moved to worker or re-evaluated.
                                             // For now, worker processes all input.

    const debouncedProcessCode = debounce(() => {
        const code = codeEditor.value;
        if (sourWorker) { // Ensure worker is initialized
            sourWorker.postMessage({ code: code, action: 'lint' }); // Specify action
        }
    }, 750);

    if (sourWorker) {
        sourWorker.onmessage = function(e) {
            const { type, tokens, ast, error, interpreterOutput, runtimeError } = e.data;
            const currentCodeValue = codeEditor.value; // Get current code for highlighting context

            if (tokens) {
                updateHighlighting(currentCodeValue, tokens);
            }

            // Update global error state based on parse error
            sourSyntaxError = error || null;
            lastValidAST = ast || null; // Store valid AST or null if parse error

            // If the message was a response to an 'execute' action, handle interpreter output
            if (type === 'execute') {
                if (runtimeError) {
                    sourOutputContainer.textContent = `Runtime Error: ${runtimeError.message || JSON.stringify(runtimeError)}`;
                    sourOutputContainer.style.color = 'red';
                } else if (error) { // If there was a parse error during the execute request
                    sourOutputContainer.textContent = `Syntax Error (L${error.line}:${error.column}): ${error.message}`;
                    sourOutputContainer.style.color = 'red';
                } else if (interpreterOutput !== null && interpreterOutput !== undefined) {
                    sourOutputContainer.textContent = interpreterOutput;
                    sourOutputContainer.style.color = '';
                } else {
                     sourOutputContainer.textContent = "Execution completed (no output)."; // Or some other placeholder
                     sourOutputContainer.style.color = '';
                }
            }

            // After updating sourSyntaxError, always call updateHighlighting
            // to ensure error underlines are refreshed based on the latest error state.
            // This is important if tokens were not part of this specific message
            // (e.g. if worker could send error updates without full token list)
            // However, our worker currently always sends tokens.
            // If tokens were already processed by updateHighlighting(tokens) above,
            // calling it again *without* tokens would rely on it using global state or last tokens.
            // The current updateHighlighting(tokens) needs tokens.
            // So, if tokens were received, highlighting is already updated with current error state.
            // If tokens were NOT received but error state might have changed (e.g. by a 'run' action that only returns error/output)
            // we still need to re-render the highlighting to apply/clear error underlines.
            // The current worker implementation always sends tokens, so this might be redundant for now,
            // but good for robustness if worker's message structure changes.
            if (!tokens && (sourSyntaxError !== (error || null))) { // If error state changed and no tokens were sent with this message
                 // We need a way to get the last known tokens or re-request them.
                 // For now, let's assume tokens are always sent if highlighting needs an update.
                 // This call to updateHighlighting will use the new sourSyntaxError state.
                 // It needs the code string.
                 updateHighlighting(currentCodeValue, tokens || []); // Pass current code and existing/empty tokens
            } else if (tokens) {
                // If tokens were received, updateHighlighting(currentCodeValue, tokens) was already called.
                // However, if sourSyntaxError changed *after* that call due to 'error' in message,
                // we might need to ensure the error display is up to date.
                // The current structure calls updateHighlighting(code, tokens) once.
                // And updateHighlighting itself uses the global sourSyntaxError.
                // This should be okay.
            }
        };
    }

    codeEditor.addEventListener('input', () => {
        debouncedProcessCode();
    });

    codeEditor.addEventListener('scroll', () => {
        if (highlightingArea) {
            highlightingArea.scrollTop = codeEditor.scrollTop;
            highlightingArea.scrollLeft = codeEditor.scrollLeft;
            highlightingArea.scrollLeft = codeEditor.scrollLeft; // ensure horizontal sync
        }
    });

    // Also update highlighting when a file is loaded
    const originalLoadFileUI = loadFileToEditor;
    loadFileToEditor = (fileName) => { // Ensure we are wrapping the correct (renamed) function
        originalLoadFileUI(fileName);
        // updateHighlighting(); // Already called at the end of the new loadFileToEditor
    };

    // Initial highlight for any existing content (e.g. from localStorage)
    // This needs to trigger a worker message now.
    if (codeEditor.value) {
        sourWorker.postMessage({ code: codeEditor.value, action: 'lint' }); // Specify action for clarity
    } else {
        // If editor is empty, call updateHighlighting directly with empty code and tokens
        // to ensure highlighting layer is cleared and consistent.
        updateHighlighting("", []);
    }
}

// Further considerations for a more robust highlighter:
// 1. Lexer that tokenizes *all* text, including all types of whitespace.
// 2. More intelligent reconstruction of text from tokens to perfectly match original spacing.
// 3. Performance optimizations for large files (e.g., only re-highlighting changed lines or viewport).
// 4. Handling of tab characters (convert to spaces or specific tab width).
// 5. Ensuring line numbers would align if added.

// --- Ctrl+I Error Message Display ---
if (codeEditor) {
    codeEditor.addEventListener('keydown', (event) => {
        // Check for Ctrl+I (or Cmd+I on Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
            event.preventDefault(); // Prevent any default browser action for Ctrl+I
            if (sourSyntaxError && sourSyntaxError.message) {
                // Format the alert message a bit better
                const errorMessage = `Sour Lang Syntax Error:
-----------------------------
Message: ${sourSyntaxError.message}
Line: ${sourSyntaxError.line}
Column: ${sourSyntaxError.column}
Length of problematic token (approx): ${sourSyntaxError.length}
-----------------------------`;
                alert(errorMessage);
            } else {
                alert("No Sour Lang syntax error detected at the moment.");
            }
        }
    });
}