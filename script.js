const codeEditor = document.getElementById('code-editor');
const runButton = document.getElementById('run-button');
const outputContainer = document.getElementById('output-container');
// Action Bar Buttons
const toggleFileTreeButton = document.getElementById('toggle-file-tree-button');
const clearOutputButton = document.getElementById('clear-output-button');
const copyCodeButton = document.getElementById('copy-code-button');
const toggleWrapButton = document.getElementById('toggle-wrap-button');
// File System Elements
const fileSystemContainer = document.getElementById('file-system-container');
const fileNameInput = document.getElementById('file-name-input');
const newFileButton = document.getElementById('new-file-button');
const saveFileButton = document.getElementById('save-file-button');
const deleteFileButton = document.getElementById('delete-file-button');
const fileListContainer = document.getElementById('file-list');

let activeFileName = null;
const localStorageKeyPrefix = 'jsIDE_file_';

// --- Core IDE Functionality ---

// Run Code Button
runButton.addEventListener('click', () => {
    const code = codeEditor.value;
    outputContainer.textContent = ''; // Clear previous output

    // Capture console.log output
    const oldLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '));
        // oldLog.apply(console, args); // Uncomment to also log to browser console
    };

    try {
        // Execute the code
        const result = new Function(code)();

        // Display captured logs
        if (logs.length > 0) {
            outputContainer.textContent += logs.join('\n') + '\n';
        }

        // Display return value if any
        if (result !== undefined) {
            outputContainer.textContent += 'Return value: ' + (typeof result === 'string' ? result : JSON.stringify(result));
        } else if (logs.length === 0) {
            outputContainer.textContent = 'Code executed successfully. No output or return value.';
        }
    } catch (error) {
        outputContainer.textContent = 'Error: ' + error.message;
    } finally {
        // Restore original console.log
        console.log = oldLog;
    }
});

// Clear Output Button
clearOutputButton.addEventListener('click', () => {
    outputContainer.textContent = '';
});

// Copy Code Button
copyCodeButton.addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeEditor.value)
            .then(() => {
                // Optional: Show a temporary message like "Code copied!"
                const originalText = copyCodeButton.textContent;
                copyCodeButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyCodeButton.textContent = originalText;
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy code: ', err);
                // Fallback for older browsers or if permission denied
                try {
                    codeEditor.select();
                    document.execCommand('copy');
                    const originalText = copyCodeButton.textContent;
                    copyCodeButton.textContent = 'Copied (fallback)!';
                    setTimeout(() => {
                        copyCodeButton.textContent = originalText;
                    }, 1500);
                } catch (e) {
                    alert('Failed to copy code. Please copy manually.');
                }
            });
    } else {
        // Fallback for very old browsers without navigator.clipboard
        try {
            codeEditor.select();
            document.execCommand('copy');
            const originalText = copyCodeButton.textContent;
            copyCodeButton.textContent = 'Copied (fallback)!';
            setTimeout(() => {
                copyCodeButton.textContent = originalText;
            }, 1500);
        } catch (e) {
            alert('Failed to copy code. Please copy manually.');
        }
    }
});

// Toggle Text Wrap Button
toggleWrapButton.addEventListener('click', () => {
    if (codeEditor.wrap === 'off') {
        codeEditor.wrap = 'soft';
        toggleWrapButton.title = 'Disable Text Wrap';
    } else {
        codeEditor.wrap = 'off';
        toggleWrapButton.title = 'Enable Text Wrap';
    }
});

// --- File System Logic ---

function getFileStorageKey(fileName) {
    return localStorageKeyPrefix + fileName;
}

function getSavedFiles() {
    const files = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(localStorageKeyPrefix)) {
            files.push(key.substring(localStorageKeyPrefix.length));
        }
    }
    return files.sort();
}

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

function saveFile(fileName, content) {
    if (!fileName || fileName.trim() === '') {
        alert('Please enter a valid file name.');
        return false;
    }
    localStorage.setItem(getFileStorageKey(fileName.trim()), content);
    activeFileName = fileName.trim();
    fileNameInput.value = activeFileName; // Update input field
    displayFiles(); // Refresh file list
    return true;
}

function loadFile(fileName) { // fileName here is the fullPath
    const content = localStorage.getItem(getFileStorageKey(fileName));
    if (content !== null) {
        codeEditor.value = content;
        activeFileName = fileName; // activeFileName is now fullPath
        fileNameInput.value = activeFileName; // Update input field

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
}

function deleteFile(fileName) {
    if (!fileName || fileName.trim() === '') {
        alert('No file selected or name provided to delete.');
        return;
    }
    if (confirm(`Are you sure you want to delete "${fileName.trim()}"?`)) {
        localStorage.removeItem(getFileStorageKey(fileName.trim()));
        if (activeFileName === fileName.trim()) {
            activeFileName = null;
            codeEditor.value = ''; // Clear editor
            fileNameInput.value = ''; // Clear input
        }
        displayFiles(); // Refresh file list
    }
}

function handleNewFile() {
    const newName = fileNameInput.value.trim();
    if (!newName) {
        alert("Please enter a name for the new file.");
        return;
    }
    if (getSavedFiles().includes(newName)) {
        if (!confirm(`File "${newName}" already exists. Overwrite it or load it? Press OK to load, Cancel to keep editing name.`)) {
            fileNameInput.focus();
            return;
        }
        loadFile(newName); // Load existing if user confirms
    } else {
        // Create a new empty file conceptually
        codeEditor.value = '';
        activeFileName = newName;
        // No need to save an empty file to localStorage immediately,
        // let the user type and then save.
        // But we should reflect it in the input and potentially list (if we want to show "new unsaved" files)
        // For now, just set activeFileName and clear editor. Save will persist.
        fileNameInput.value = activeFileName;
        // Remove active class from others
        const currentActive = fileListContainer.querySelector('.active-file');
        if (currentActive) {
            currentActive.classList.remove('active-file');
        }
        // It won't be in the list until saved, so displayFiles() won't mark it yet.
        // We could add a temporary "new file" visual cue if desired.
        alert(`New file "${newName}" ready. Type your code and click Save.`);
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
            if (getSavedFiles().includes(fullPath)) {
                alert(`File "${fullPath}" already exists.`);
            } else {
                // Create a new empty file
                codeEditor.value = ''; // Clear editor for new file
                activeFileName = fullPath;
                fileNameInput.value = activeFileName; // Update input field
                saveFile(activeFileName, ''); // Save the new empty file
                // displayFiles() will be called by saveFile
                alert(`File "${fullPath}" created.`);
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
newFileButton.addEventListener('click', handleNewFile);

saveFileButton.addEventListener('click', () => {
    const fileName = fileNameInput.value.trim() || activeFileName;
    if (!fileName) {
        alert("Please enter a file name or select an existing file to save.");
        fileNameInput.focus();
        return;
    }
    saveFile(fileName, codeEditor.value);
});

deleteFileButton.addEventListener('click', () => {
    const fileNameToDelete = fileNameInput.value.trim() || activeFileName;
    if (!fileNameToDelete) {
        alert("Please enter a file name or select a file from the list to delete.");
        return;
    }
    deleteFile(fileNameToDelete);
});

// Ensure fileNameInput updates activeFileName if user types and blurs,
// but only if it's not already an existing file (to avoid accidental overwrite intent)
// This might be too complex for now; primary interaction is via buttons and list.
// For now, fileNameInput primarily serves to name new files or specify for deletion if not selected.
