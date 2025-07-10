// filetree.js - Handles localStorage interactions for files

const localStorageKeyPrefix = 'jsIDE_file_';

export function getFileStorageKey(fileName) {
    return localStorageKeyPrefix + fileName;
}

export function getSavedFiles() {
    const files = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(localStorageKeyPrefix)) {
            files.push(key.substring(localStorageKeyPrefix.length));
        }
    }
    return files.sort();
}

/**
 * Saves file content to localStorage.
 * @param {string} fileName - The name of the file to save.
 * @param {string} content - The content to save.
 * @returns {boolean} True if save was successful (name was valid), false otherwise.
 */
export function saveFileToStorage(fileName, content) {
    if (!fileName || fileName.trim() === '') {
        // Caller should handle alert: alert('Please enter a valid file name.');
        return false;
    }
    localStorage.setItem(getFileStorageKey(fileName.trim()), content);
    return true;
}

/**
 * Loads file content from localStorage.
 * @param {string} fileName - The name of the file to load.
 * @returns {string|null} The file content, or null if not found.
 */
export function loadFileFromStorage(fileName) {
    return localStorage.getItem(getFileStorageKey(fileName));
}

/**
 * Deletes a file from localStorage.
 * @param {string} fileName - The name of the file to delete.
 * @returns {void}
 */
export function deleteFileFromStorage(fileName) {
    // Caller should handle confirm: if (confirm(`Are you sure you want to delete "${fileName.trim()}"?`))
    localStorage.removeItem(getFileStorageKey(fileName.trim()));
}
