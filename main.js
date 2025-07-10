import { getFileStorageKey, getSavedFiles, saveFileToStorage, loadFileFromStorage, deleteFileFromStorage } from './filetree.js'
import Parser from "./libs/sourlang/parser.js"
import SpannableText from "./libs/spannable-text.js"

const codeEditor = document.getElementById('code-editor');

const toggleFileTreeButton = document.getElementById('nav-icon');
const actionBarSaveButton = document.getElementById('save'); // Added

const fileSystemContainer = document.getElementById('file-system-container');
const fileListContainer = document.getElementById('file-list');

const runSourButton = document.getElementById('run');
const sourOutputContainer = document.getElementById('sour-output-container');

const highlightingArea = document.getElementById('highlighting-area');
const highlightingLayer = document.getElementById('highlighting-layer');

let activeFileName = null;

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

// UI-facing save operation
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

// UI-facing load operation
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
    updateHighlighting(codeEditor.value); // Pass the loaded code to updateHighlighting
}

// UI-facing delete operation
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
            updateHighlighting(''); // Clear highlighting too
        }
        displayFiles(); // Refresh file list
    }
}

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
            if (getSavedFiles().includes(fullPath)) { // getSavedFiles is from filetree.js
                alert(`File "${fullPath}" already exists.`);
            } else {
                codeEditor.value = '';
                activeFileName = fullPath;
                saveActiveFile(activeFileName, ''); // Use the new UI-facing save function
                // displayFiles() is called by saveActiveFile
                alert(`File "${fullPath}" created.`);
                updateHighlighting(''); // Update for empty content
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
        // Dispatch 'execute' action to the worker.
        // The worker is responsible for parsing, execution, and sending results/errors back.
        // sourWorker.postMessage({ code: code, action: 'execute' }); // Assuming sourWorker is defined elsewhere or will be

        // TODO: The sourWorker is not defined in this file. This needs to be addressed.
        // For now, we'll leave the postMessage commented out if sourWorker is not available here.
        // If a direct parser/executor is to be used (like in updateHighlighting), that logic would go here.
        // However, the README and plan suggest a worker-based approach for execution.

        // Placeholder for worker communication or direct execution:
        console.log("Run Sour Code button clicked. Code to execute:", code);
        sourOutputContainer.textContent = "Execution via worker is intended but not fully wired here yet. See console.";
        sourOutputContainer.style.color = 'orange';

        // Since sourWorker is not available, we'll use direct parsing and a simple interpreter.
        const parser = new Parser(code);
        const parseResult = parser.parse();

        if (parseResult.errors && parseResult.errors.length > 0) {
            // Display first parse error
            const error = parseResult.errors[0];
            let errorMessage = "Error: ";
            if (typeof error === 'string') {
                errorMessage += error;
            } else if (error.message) {
                errorMessage += error.message;
                if (error.token && error.token.start) {
                     errorMessage += ` at line ${error.token.start.lineno}, column ${error.token.start.col}`;
                }
            } else {
                errorMessage += "Unknown parsing error.";
            }
            sourOutputContainer.textContent = errorMessage;
            sourOutputContainer.style.color = 'red';
        } else if (parseResult.ast) {
            // Simple interpreter for 'print "string"'
            let output = [];
            let runtimeError = null;
            try {
                parseResult.ast.forEach(stmt => {
                    if (!stmt) return;
                    if (stmt.type === 'print') {
                        if (stmt.expr && stmt.expr.type === 'str') {
                            output.push(stmt.expr.value);
                        } else {
                            // This case implies a parser bug or language extension not yet handled
                            // For "print" followed by non-string, it's a semantic error if not a syntax error.
                            runtimeError = { message: "Invalid expression for print statement. Expected a string." };
                            throw runtimeError; // Stop execution
                        }
                    } else if (stmt.type) {
                        // Handle unknown statement types if parser allows them but interpreter doesn't
                        runtimeError = { message: `Unknown statement type: ${stmt.type}`};
                        throw runtimeError;
                    }
                });

                if (runtimeError) {
                    sourOutputContainer.textContent = `Runtime Error: ${runtimeError.message}`;
                    sourOutputContainer.style.color = 'red';
                } else {
                    sourOutputContainer.textContent = output.join('\n');
                    sourOutputContainer.style.color = ''; // Default color
                }

            } catch (e) {
                // Catch errors thrown by the interpreter logic (like the explicit throw above)
                sourOutputContainer.textContent = `Runtime Error: ${e.message || "Unknown execution error."}`;
                sourOutputContainer.style.color = 'red';
            }
            // console.log("Generated AST:", parseResult.ast); // For debugging
        } else {
            sourOutputContainer.textContent = "Could not parse the code for execution. No AST generated.";
            sourOutputContainer.style.color = 'orange';
        }
    });
}

// `updateHighlighting` is the primary way to show syntax feedback live.
// The `code` parameter for `updateHighlighting` was sometimes missing in calls.
// It should be called with `codeEditor.value`.
// The `prog` parameter (parsed program) is generated within `updateHighlighting` if only code is passed,
// or can be passed directly if already parsed.

// Let's make `updateHighlighting` always take code, and parse internally.
function updateHighlighting(code) {
    if (typeof code !== 'string') {
        // Fallback if called without code, though this should be avoided.
        // console.warn("updateHighlighting called without code. Using codeEditor.value.");
        code = codeEditor.value;
    }
    const parser = new Parser(code);
    const prog = parser.parse();
    const text = new SpannableText(code);

    // console.log("Highlighting:", code, prog); // Debugging

    if (prog.ast) {
        prog.ast.forEach(stmt => {
            if (!stmt) return; // Skip null/undefined statements if parser produces them

            if (stmt.type === 'print') {
                if (stmt.kw) highlightToken(text, stmt.kw, 'tok-kw');
                if (stmt.expr) highlightExpr(text, stmt.expr);
            }
            // Add more statement types here if language expands
        });
    }
    
    // Displaying first parse error directly in highlighting (optional, could be too noisy)
    // For now, errors are primarily shown via Ctrl+I or in sourOutputContainer on Run.
    // If prog.errors exists and has errors, we could underline the first one.
    // Example: if (prog.errors && prog.errors.length > 0 && prog.errors[0].token) {
    //    const errorToken = prog.errors[0].token; // Assuming error is associated with a token
    //    text.error(errorToken.start.index, errorToken.end.index); // `error` method needs to be working in SpannableText
    // }


    highlightingLayer.innerHTML = text.toString();

    // Synchronize scroll
    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}

function highlightToken(text, token, cssClass) { // Renamed color to cssClass for clarity
    if (token && typeof token.start !== 'undefined' && typeof token.end !== 'undefined') {
        text.color(token.start.index, token.end.index, cssClass);
    } else {
        // console.warn("Invalid token for highlighting:", token);
    }
}

function highlightExpr(text, expr) {
    if (!expr) return;
    if (expr.type === 'str') {
        // Assuming string literal tokens have start/end directly
        highlightToken(text, expr, "tok-str");
    }
    // Add more expression types here
}


if (codeEditor) {
    codeEditor.addEventListener('input', () => {
        // updateHighlighting now parses the code itself
        updateHighlighting(codeEditor.value);
    });

    codeEditor.addEventListener('scroll', () => {
        if (highlightingArea) {
            highlightingArea.scrollTop = codeEditor.scrollTop;
            highlightingArea.scrollLeft = codeEditor.scrollLeft;
            // highlightingArea.scrollLeft = codeEditor.scrollLeft; // Redundant line
        }
    });
}

// Further considerations for a more robust highlighter:
// 1. Lexer that tokenizes *all* text, including all types of whitespace. (Partially done by Parser)
// 2. More intelligent reconstruction of text from tokens to perfectly match original spacing. (SpannableText helps)
// 3. Performance optimizations for large files (e.g., only re-highlighting changed lines or viewport). (Currently re-parses all)
// 4. Handling of tab characters (convert to spaces or specific tab width). (CSS tab-size handles this)
// 5. Ensuring line numbers would align if added. (Not implemented)

// --- Ctrl+I Error Message Display ---
// This relies on `sourSyntaxError` which was planned for removal.
// We should get error information from the `Parser` instance.
// Let's store the latest parse result from `updateHighlighting` to access errors.
let lastParseResult = null;

// Modify updateHighlighting to store its parse result
function updateHighlighting(code) { // Definition will be merged by tool, this is for context
    if (typeof code !== 'string') code = codeEditor.value;
    const parser = new Parser(code);
    lastParseResult = parser.parse(); // Store the result
    const prog = lastParseResult; // Use it
    const text = new SpannableText(code);

    if (prog.ast) {
        prog.ast.forEach(stmt => {
            if (!stmt) return;
            if (stmt.type === 'print') {
                if (stmt.kw) highlightToken(text, stmt.kw, 'tok-kw');
                if (stmt.expr) highlightExpr(text, stmt.expr);
            }
        });
    }
    highlightingLayer.innerHTML = text.toString();
    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}


if (codeEditor) {
    // `input` and `scroll` listeners are already defined above, they will be merged.

    codeEditor.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
            event.preventDefault();
            if (lastParseResult && lastParseResult.errors && lastParseResult.errors.length > 0) {
                // Assuming the error object from parser.js is a string or has a .message property
                // And potentially .line, .col if BaseParser adds them.
                // For now, let's join all error messages if there are multiple.
                const errorMessages = lastParseResult.errors.map(err => {
                    if (typeof err === 'string') return err;
                    if (err.message) {
                        let details = `Message: ${err.message}`;
                        if (err.token && err.token.start) { // Assuming error might have token info
                            details += `\nLine: ${err.token.start.lineno}, Column: ${err.token.start.col}`;
                        }
                        return details;
                    }
                    return "Unknown error format.";
                }).join('\n-----------------------------\n');

                alert(`Sour Lang Syntax Error(s):
-----------------------------
${errorMessages}
-----------------------------`);
            } else {
                alert("No Sour Lang syntax error detected from the last parse.");
            }
        }
    });
}