import { getFileStorageKey, getSavedFiles, saveFileToStorage, loadFileFromStorage, deleteFileFromStorage } from './filetree.js';
import { initializeEditor, updateHighlighting } from './editor.js'; // Import editor functions
import Interpreter from "./libs/sourlang/interpreter.js";
import { Menu } from "./libs/ui/ui.js";

const actionBar = document.querySelector('action-bar');
const codeEditor = document.getElementById('code-editor');
const fileSystemContainer = document.getElementById('file-system-container');
const fileListContainer = document.getElementById('file-list');
const highlightingArea = document.getElementById('highlighting-area');
const highlightingLayer = document.getElementById('highlighting-layer');
const tabBar = document.getElementById('tab-bar');
const tabContent = document.getElementById('tab-content');

let activeFileName = null;
let activeTabs = [];

// Action Bar
const menu = new Menu();
menu.addItem("save", "Save", "icon/save.svg");
menu.addItem("run", "Run", "icon/play-arrow.svg");
actionBar.menu = menu;

actionBar.onmenuitemclicked = ev => {
    switch (ev.detail) {
        case 'save': {
            const fileName = activeFileName;
            if (!fileName) {
                alert("No active file selected to save. Please open a file or create a new one via the context menu.");
                return;
            }
            saveActiveFile(fileName, codeEditor.value);
            break;
        }
        case 'run': {
            const interpreter = new Interpreter(codeEditor.value, "internal.sour");
            const outputFileName = "Output";
            let outputContent = "";
            addTab(outputFileName, outputContent);
            
            interpreter.interprete();
        
            const updateOutput = (chunk) => {
                const tabIndex = activeTabs.findIndex(tab => tab.fileName === outputFileName);
                if (tabIndex !== -1) {
                    activeTabs[tabIndex].content += chunk;
                    if (activeFileName === outputFileName) {
                        codeEditor.value = activeTabs[tabIndex].content;
                    }
                }
            };
        
            (async () => {
                while (true) {
                    const chunk = await interpreter.inputStream.read();
                    updateOutput(chunk);
                }
            })();
        
            (async () => {
                while (true) {
                    const chunk = await interpreter.errorStream.read();
                    updateOutput(chunk);
                }
            })();
            break;
        }
    }
};

// Tab System Functions
function addTab(fileName, content) {
    const existingTab = activeTabs.find(tab => tab.fileName === fileName);
    if (existingTab) {
        activateTab(fileName);
        return;
    }

    const tabItem = document.createElement('div');
    tabItem.classList.add('tab-item');
    tabItem.dataset.fileName = fileName;

    const tabNameSpan = document.createElement('span');
    tabNameSpan.textContent = fileName.split('/').pop();
    tabItem.appendChild(tabNameSpan);

    const closeButton = document.createElement('span');
    closeButton.classList.add('tab-close-button');
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(fileName);
    });
    tabItem.appendChild(closeButton);

    tabItem.addEventListener('click', () => activateTab(fileName));
    tabBar.appendChild(tabItem);

    activeTabs.push({ fileName, content });
    activateTab(fileName);
}

function activateTab(fileName) {
    const currentActiveTab = tabBar.querySelector('.tab-item.active');
    if (currentActiveTab) {
        currentActiveTab.classList.remove('active');
    }

    const newActiveTab = tabBar.querySelector(`.tab-item[data-file-name="${fileName}"]`);
    if (newActiveTab) {
        newActiveTab.classList.add('active');
    }

    if (activeFileName && activeFileName !== fileName) {
        const currentFileIndex = activeTabs.findIndex(tab => tab.fileName === activeFileName);
        if (currentFileIndex !== -1) {
            activeTabs[currentFileIndex].content = codeEditor.value;
        }
    }

    const tabToLoad = activeTabs.find(tab => tab.fileName === fileName);
    if (tabToLoad) {
        codeEditor.value = tabToLoad.content;
        activeFileName = fileName;
        updateHighlighting(codeEditor.value, codeEditor, highlightingArea, highlightingLayer);

        if (fileName === "Output") {
            codeEditor.setAttribute('readonly', 'true');
            codeEditor.classList.add('output-mode');
            highlightingArea.style.display = 'none';
        } else {
            codeEditor.removeAttribute('readonly');
            codeEditor.classList.remove('output-mode');
            highlightingArea.style.display = 'block';
        }
    }
}

function closeTab(fileName) {
    const tabToRemove = tabBar.querySelector(`.tab-item[data-file-name="${fileName}"]`);
    if (tabToRemove) {
        tabBar.removeChild(tabToRemove);
    }

    const indexToRemove = activeTabs.findIndex(tab => tab.fileName === fileName);
    if (indexToRemove !== -1) {
        activeTabs.splice(indexToRemove, 1);
    }

    if (activeFileName === fileName) {
        if (activeTabs.length > 0) {
            activateTab(activeTabs[activeTabs.length - 1].fileName);
        } else {
            activeFileName = null;
            codeEditor.value = '';
            updateHighlighting('', codeEditor, highlightingArea, highlightingLayer);
        }
    }
}

function displayFiles() {
    fileListContainer.innerHTML = '';
    const files = getSavedFiles();
    const fileTree = { '/': [] };

    files.forEach(fullPath => {
        const parts = fullPath.split('/');
        if (parts.length > 1 && parts[0] !== '') {
            const folderName = parts[0];
            const fileName = parts.slice(1).join('/');
            if (!fileTree[folderName]) {
                fileTree[folderName] = [];
            }
            fileTree[folderName].push(fileName);
        } else {
            fileTree['/'].push(fullPath.startsWith('/') ? fullPath.substring(1) : fullPath);
        }
    });

    let folderNames = Object.keys(fileTree);
    folderNames = folderNames.sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
    });

    folderNames.forEach(folderName => {
        if (folderName !== '/' && fileTree[folderName].length === 0) {
            return;
        }

        const folderContainer = document.createElement('div');
        folderContainer.classList.add('folder-entry');

        const folderHeader = document.createElement('div');
        folderHeader.classList.add('folder-header');
        folderHeader.dataset.folderPath = folderName === '/' ? '/' : `${folderName}/`;
        folderHeader.dataset.isRoot = (folderName === '/').toString();

        const folderIcon = document.createElement('span');
        folderIcon.classList.add('material-symbols-rounded', 'folder-icon');
        folderIcon.textContent = 'folder';
        folderHeader.appendChild(folderIcon);

        const folderNameSpan = document.createElement('span');
        folderNameSpan.textContent = folderName;
        folderNameSpan.classList.add('folder-name');
        folderHeader.appendChild(folderNameSpan);
        folderContainer.appendChild(folderHeader);

        const filesInFolderDiv = document.createElement('div');
        filesInFolderDiv.classList.add('files-in-folder');

        fileTree[folderName].sort().forEach(fileNameInFolder => {
            const fullPath = (folderName === '/') ? fileNameInFolder : `${folderName}/${fileNameInFolder}`;
            const fileEntry = document.createElement('div');
            fileEntry.classList.add('file-entry');
            fileEntry.textContent = (folderName === '/') ? fullPath : fileNameInFolder;
            fileEntry.dataset.fullPath = fullPath;

            if (fullPath === activeFileName) {
                fileEntry.classList.add('active-file');
            }
            fileEntry.addEventListener('click', (e) => {
                e.stopPropagation();
                loadFile(fullPath);
            });
            filesInFolderDiv.appendChild(fileEntry);
        });
        folderContainer.appendChild(filesInFolderDiv);

        folderHeader.addEventListener('click', () => {
            const isOpen = filesInFolderDiv.style.display !== 'none';
            filesInFolderDiv.style.display = isOpen ? 'none' : 'block';
            folderContainer.classList.toggle('open', !isOpen);
            folderIcon.textContent = isOpen ? 'folder' : 'folder_open';
        });

        let shouldBeOpen = false;
        if (folderName === '/') {
            shouldBeOpen = activeFileName && activeFileName.indexOf('/') === -1 && activeFileName !== '';
        } else {
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
}

function saveActiveFile(fileName, content) {
    if (!fileName || fileName.trim() === '') {
        alert('Please enter a valid file name.');
        return false;
    }
    if (saveFileToStorage(fileName.trim(), content)) {
        activeFileName = fileName.trim();
        const tabIndex = activeTabs.findIndex(tab => tab.fileName === fileName);
        if (tabIndex !== -1) {
            activeTabs[tabIndex].content = content;
        }
        displayFiles();
        return true;
    }
    return false;
}

function loadFile(fileName) {
    const content = loadFileFromStorage(fileName);
    if (content !== null) {
        addTab(fileName, content);
    } else {
        alert(`File "${fileName}" not found.`);
    }
}

function deleteActiveFile(fileName) {
    if (!fileName || fileName.trim() === '') {
        alert('No file selected or name provided to delete.');
        return;
    }
    if (confirm(`Are you sure you want to delete "${fileName.trim()}"?`)) {
        deleteFileFromStorage(fileName.trim());
        closeTab(fileName.trim());
        displayFiles();
    }
}

// Context Menu Logic
let contextMenuTimeout;
const CONTEXT_MENU_HOLD_DURATION = 700;

function showContextMenu(x, y, targetElement) {
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const isRootFolder = targetElement.dataset.isRoot === 'true';
    const folderPath = targetElement.dataset.folderPath;

    const createFileOption = document.createElement('div');
    createFileOption.textContent = 'Create File';
    createFileOption.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        const newFileName = prompt(`Enter name for new file in ${folderPath === '/' ? 'root' : folderPath}:`);
        if (newFileName && newFileName.trim() !== '') {
            const fullPath = folderPath === '/' ? newFileName.trim() : `${folderPath}${newFileName.trim()}`;
            if (getSavedFiles().includes(fullPath)) {
                alert(`File "${fullPath}" already exists.`);
            } else {
                saveFileToStorage(fullPath, '');
                addTab(fullPath, '');
                displayFiles();
                alert(`File "${fullPath}" created.`);
            }
        }
    });
    menu.appendChild(createFileOption);

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', function closeMenuOnClickOutside(event) {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenuOnClickOutside);
            }
        }, { once: true });
    }, 0);
}

function initializeContextMenu() {
    fileListContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    fileListContainer.addEventListener('touchend', handleTouchEnd);
    fileListContainer.addEventListener('contextmenu', handleContextMenu);
}

function handleTouchStart(event) {
    const targetFolderHeader = event.target.closest('.folder-header');
    if (targetFolderHeader) {
        clearTimeout(contextMenuTimeout);
        contextMenuTimeout = setTimeout(() => {
            event.preventDefault();
            showContextMenu(event.touches[0].pageX, event.touches[0].pageY, targetFolderHeader);
        }, CONTEXT_MENU_HOLD_DURATION);
    }
}

function handleTouchEnd(event) {
    clearTimeout(contextMenuTimeout);
}

function handleContextMenu(event) {
    const targetFolderHeader = event.target.closest('.folder-header');
    if (targetFolderHeader) {
        event.preventDefault();
        showContextMenu(event.pageX, event.pageY, targetFolderHeader);
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Check if there are any saved files
    if (getSavedFiles().length === 0) {
        // If not, create a default file
        const defaultFileName = "untitled.sour";
        const defaultContent = 'print "Hello, Sour Lang!"\n';
        saveFileToStorage(defaultFileName, defaultContent);
        addTab(defaultFileName, defaultContent);
    }
    displayFiles();
    initializeContextMenu();
    initializeEditor(codeEditor, highlightingArea, highlightingLayer); // Initialize editor
});