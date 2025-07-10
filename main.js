import { getFileStorageKey, getSavedFiles, saveFileToStorage, loadFileFromStorage, deleteFileFromStorage } from './filetree.js'
import Parser from "./libs/sourlang/parser.js"
import Interpreter from "./libs/sourlang/interpreter.js"
import SpannableText from "./libs/spannable-text.js"
import { Menu } from "./libs/ui.js"

const actionBar = document.querySelector('action-bar')

const codeEditor = document.getElementById('code-editor');

const fileSystemContainer = document.getElementById('file-system-container');
const fileListContainer = document.getElementById('file-list');

const sourOutputContainer = document.getElementById('sour-output-container');

const highlightingArea = document.getElementById('highlighting-area');
const highlightingLayer = document.getElementById('highlighting-layer');

let activeFileName = null;


// Action Bar
const menu = new Menu()

menu.addItem("save", "icon/save.svg")
menu.addItem("run", "icon/play-arrow.svg")

actionBar.navigationIconSrc = 'icon/menu.svg'
actionBar.menu = menu

actionBar.onnavigation = () => fileSystemContainer.classList.toggle('open')

actionBar.onmenuitemclicked = ev => {
    switch(ev.detail) {
        case 'save': {
            const fileName = activeFileName
            
            if (!fileName) {
                alert("No active file selected to save. Please open a file or create a new one via the context menu.");
                return;
            }
            
            saveActiveFile(fileName, codeEditor.value)
            break
        }
        
        case 'run': {
            const interpreter = new Interpreter(codeEditor.value, "internal.sour")
        
            interpreter.interprete()
        
            ;(async () => {
                while(true) {
                    const chunk = await interpreter.inputStream.read()
                    sourOutputContainer.innerText += chunk
                }
            })()
        
            ;(async () => {
                while(true) {
                    const chunk = await interpreter.errorStream.read()
                    sourOutputContainer.innerText += chunk
                }
            })()
            
            break
        }
    }
}

// Others

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

function highlightToken(text, token, cssClass) {
    text.color(token.start.index, token.end.index, cssClass)
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
        removeErrorTooltip();
        showAutocomplete();
    });

    codeEditor.addEventListener('scroll', () => {
        if (highlightingArea) {
            highlightingArea.scrollTop = codeEditor.scrollTop;
            highlightingArea.scrollLeft = codeEditor.scrollLeft;
            // highlightingArea.scrollLeft = codeEditor.scrollLeft; // Redundant line
        }
    });
    
    codeEditor.addEventListener('keydown', (e) => {
        if (autocompletePopup) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateAutocomplete(e.key);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = autocompletePopup.querySelector('.selected');
                if (selected) {
                    insertSuggestion(selected.textContent);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (autocompletePopup) {
                    autocompletePopup.remove();
                    autocompletePopup = null;
                }
            }
        }

        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            if (lastParseResult && lastParseResult.errors.length > 0) {
                const cursorPosition = codeEditor.selectionStart;
                const error = lastParseResult.errors.find(err => {
                    return cursorPosition >= err.start.index && cursorPosition <= err.end.index;
                });

                if (error) {
                    showErrorTooltip(error);
                } else {
                    removeErrorTooltip();
                }
            }
        }
    });

}

function getCursorCoords() {
    // Create a mirror div
    const mirrorDiv = document.createElement('div');
    const style = mirrorDiv.style;
    const computed = window.getComputedStyle(codeEditor);

    // Copy styles
    const properties = [
        'border', 'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'height', 'letterSpacing',
        'lineHeight', 'padding', 'textAlign', 'textDecoration', 'textIndent',
        'textTransform', 'whiteSpace', 'wordSpacing', 'wordWrap', 'width', 'tabSize', '-moz-tab-size'
    ];
    properties.forEach(prop => {
        style[prop] = computed[prop];
    });

    // Position off-screen
    style.position = 'absolute';
    style.visibility = 'hidden';

    document.body.appendChild(mirrorDiv);

    // Set content and add a span to measure position
    mirrorDiv.textContent = codeEditor.value.substring(0, codeEditor.selectionStart);
    const span = document.createElement('span');
    span.textContent = '.'; // A character to get position from
    mirrorDiv.appendChild(span);

    // Get position of the span
    const coords = {
        x: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        y: span.offsetTop + parseInt(computed['borderTopWidth'])
    };

    document.body.removeChild(mirrorDiv);

    const editorRect = codeEditor.getBoundingClientRect();

    // Adjust for scroll position and editor's position on the page
    return {
        x: editorRect.left + coords.x - codeEditor.scrollLeft,
        y: editorRect.top + coords.y - codeEditor.scrollTop
    };
}

function showErrorTooltip(error) {
    removeErrorTooltip(); // Remove existing tooltip

    const tooltip = document.createElement('div');
    tooltip.className = 'error-tooltip';
    tooltip.textContent = error.message;
    document.body.appendChild(tooltip);

    const cursorCoords = getCursorCoords();
    tooltip.style.left = `${cursorCoords.x}px`;
    tooltip.style.top = `${cursorCoords.y - tooltip.offsetHeight}px`; // Position above cursor
}

function removeErrorTooltip() {
    const existingTooltip = document.querySelector('.error-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

let autocompletePopup = null;

function showAutocomplete() {
    if (autocompletePopup) {
        autocompletePopup.remove();
        autocompletePopup = null;
    }

    const cursorPosition = codeEditor.selectionStart;
    const textBeforeCursor = codeEditor.value.substring(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).pop();

    if (currentWord.length === 0) return;

    const keywords = ['print']; // Add more keywords as needed
    const suggestions = keywords.filter(kw => kw.startsWith(currentWord));

    if (suggestions.length > 0) {
        autocompletePopup = document.createElement('div');
        autocompletePopup.className = 'autocomplete-popup';

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = suggestion;
            if (index === 0) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => {
                insertSuggestion(suggestion);
            });
            autocompletePopup.appendChild(item);
        });

        const cursorCoords = getCursorCoords();
        autocompletePopup.style.left = `${cursorCoords.x}px`;
        autocompletePopup.style.top = `${cursorCoords.y + 20}px`; // Position below cursor

        document.body.appendChild(autocompletePopup);
    }
}

function insertSuggestion(suggestion) {
    const cursorPosition = codeEditor.selectionStart;
    const textBeforeCursor = codeEditor.value.substring(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).pop();
    const textAfterCursor = codeEditor.value.substring(cursorPosition);

    const newText = textBeforeCursor.substring(0, textBeforeCursor.length - currentWord.length) + suggestion + textAfterCursor;
    codeEditor.value = newText;
    updateHighlighting(newText);

    if (autocompletePopup) {
        autocompletePopup.remove();
        autocompletePopup = null;
    }

    codeEditor.focus();
    codeEditor.selectionEnd = cursorPosition - currentWord.length + suggestion.length;
}

function navigateAutocomplete(key) {
    if (!autocompletePopup) return;

    const items = autocompletePopup.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    let selectedIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('selected')) {
            selectedIndex = index;
        }
    });

    items[selectedIndex].classList.remove('selected');

    if (key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % items.length;
    } else if (key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    }

    items[selectedIndex].classList.add('selected');
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
}

let lastParseResult = null;

function updateHighlighting(code) {
    if (typeof code !== 'string') {
        code = codeEditor.value;
    }
    const parser = new Parser(code);
    lastParseResult = parser.parse(); // Store parse result
    const prog = lastParseResult;
    const text = new SpannableText(code);

    prog.ast.forEach(stmt => {
        if (!stmt) return;
        if (stmt.type === 'print') {
            if (stmt.kw) highlightToken(text, stmt.kw, 'tok-kw');
            if (stmt.expr) highlightExpr(text, stmt.expr);
        }
    });
    
    prog.errors.forEach(err => {
        text.error(err.start.index, err.end.index)
    })
    
    highlightingLayer.innerHTML = text.toString();

    // Synchronize scroll
    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}