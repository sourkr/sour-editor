import Parser from "./libs/sourlang/parser.js";
import Validator from "./libs/sourlang/validator.js";
import SpannableText from "./libs/spannable-text.js";

// Global variables (these could be passed as parameters or managed via a class if preferred)
let lastParseResult = null;
let autocompletePopup = null;

export function initializeEditor(codeEditor, highlightingArea, highlightingLayer) {
    // Event Listeners
    if (codeEditor) {
        codeEditor.addEventListener('input', (e) => {
            if (e.inputType === 'insertText') {
                const start = codeEditor.selectionStart;
                const end = codeEditor.selectionEnd;
                const text = codeEditor.value;

                if (e.data === '"') {
                    codeEditor.value = text.substring(0, start - 1) + '""' + text.substring(end);
                    codeEditor.selectionStart = codeEditor.selectionEnd = start;
                } else if (e.data === "'") {
                    codeEditor.value = text.substring(0, start - 1) + "''" + text.substring(end);
                    codeEditor.selectionStart = codeEditor.selectionEnd = start;
                } else if (e.data === '(') {
                    codeEditor.value = text.substring(0, start - 1) + '()' + text.substring(end);
                    codeEditor.selectionStart = codeEditor.selectionEnd = start;
                }
            }

            updateHighlighting(codeEditor.value, codeEditor, highlightingArea, highlightingLayer);
            removeErrorTooltip();
            showAutocomplete(codeEditor);
        });

        codeEditor.addEventListener('scroll', () => {
            if (highlightingArea) {
                highlightingArea.scrollTop = codeEditor.scrollTop;
                highlightingArea.scrollLeft = codeEditor.scrollLeft;
            }
        });

        codeEditor.addEventListener('keyup', () => {
            updateHighlighting(codeEditor.value, codeEditor, highlightingArea, highlightingLayer);
        });

        codeEditor.addEventListener('click', () => {
            updateHighlighting(codeEditor.value, codeEditor, highlightingArea, highlightingLayer);
        });

        codeEditor.addEventListener('keydown', (e) => {
            console.log(e);
            if (autocompletePopup) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateAutocomplete(e.key);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const selected = autocompletePopup.querySelector('.selected');
                    if (selected) {
                        insertSuggestion(selected.dataset.suggestion, selected.dataset.suggestionType, codeEditor);
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
                        showErrorTooltip(error, codeEditor);
                    } else {
                        removeErrorTooltip();
                    }
                }
            }
        });
    }
}

function highlightToken(text, token, cssClass) {
    text.color(token.start.index, token.end.index, cssClass);
}

function highlightExpr(text, expr) {
    if (!expr) return;
    if (expr.type === 'str') {
        highlightToken(text, expr, "tok-str");
    } else if (expr.type === 'char') {
        highlightToken(text, expr, "tok-char");
    }
    // Add more expression types here
}

function findMatchingBracket(code, position) {
    const brackets = {
        '(': ')', ')': '(',
        '[': ']', ']': '[',
        '{': '}', '}': '{'
    };

    const openBrackets = ['(', '[', '{'];
    const closeBrackets = [')', ']', '}'];

    const char = code[position];
    if (!brackets[char]) {
        return -1; // Not a bracket
    }

    const isOpening = openBrackets.includes(char);
    const targetBracket = brackets[char];
    let balance = 0;

    if (isOpening) {
        for (let i = position + 1; i < code.length; i++) {
            if (openBrackets.includes(code[i])) {
                balance++;
            } else if (closeBrackets.includes(code[i])) {
                if (code[i] === targetBracket) {
                    if (balance === 0) {
                        return i;
                    } else {
                        balance--;
                    }
                }
            }
        }
    } else { // Closing bracket
        for (let i = position - 1; i >= 0; i--) {
            if (closeBrackets.includes(code[i])) {
                balance++;
            } else if (openBrackets.includes(code[i])) {
                if (code[i] === targetBracket) {
                    if (balance === 0) {
                        return i;
                    } else {
                        balance--;
                    }
                }
            }
        }
    }
    return -1; // No matching bracket found
}

function getCursorCoords(codeEditor) {
    const mirrorDiv = document.createElement('div');
    const style = mirrorDiv.style;
    const computed = window.getComputedStyle(codeEditor);

    const properties = [
        'border', 'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'height', 'letterSpacing',
        'lineHeight', 'padding', 'textAlign', 'textDecoration', 'textIndent',
        'textTransform', 'whiteSpace', 'wordSpacing', 'wordWrap', 'width', 'tabSize', '-moz-tab-size'
    ];
    properties.forEach(prop => {
        style[prop] = computed[prop];
    });

    style.position = 'absolute';
    style.visibility = 'hidden';

    document.body.appendChild(mirrorDiv);

    mirrorDiv.textContent = codeEditor.value.substring(0, codeEditor.selectionStart);
    const span = document.createElement('span');
    span.textContent = '.';
    mirrorDiv.appendChild(span);

    const coords = {
        x: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        y: span.offsetTop + parseInt(computed['borderTopWidth'])
    };

    document.body.removeChild(mirrorDiv);

    const editorRect = codeEditor.getBoundingClientRect();

    return {
        x: editorRect.left + coords.x - codeEditor.scrollLeft,
        y: editorRect.top + coords.y - codeEditor.scrollTop
    };
}

function showErrorTooltip(error, codeEditor) {
    removeErrorTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'error-tooltip';
    tooltip.textContent = error.message;
    document.body.appendChild(tooltip);

    const cursorCoords = getCursorCoords(codeEditor);
    tooltip.style.left = `${cursorCoords.x}px`;
    tooltip.style.top = `${cursorCoords.y - tooltip.offsetHeight}px`;
}

function removeErrorTooltip() {
    const existingTooltip = document.querySelector('.error-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

function showAutocomplete(codeEditor) {
    if (autocompletePopup) {
        autocompletePopup.remove();
        autocompletePopup = null;
    }

    const cursorPosition = codeEditor.selectionStart;
    const textBeforeCursor = codeEditor.value.substring(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).pop();

    if (currentWord.length === 0) return;

    const keywords = ['print'];
        const functions = [{ value: '_stdout', description: 'Prints output to the console.' }];

        const keywordSuggestions = keywords.filter(kw => kw.startsWith(currentWord)).map(s => ({ type: 'keyword', value: s }));
        const functionSuggestions = functions.filter(func => func.value.startsWith(currentWord)).map(s => ({ type: 'function', value: s.value, description: s.description }));

        const suggestions = [...keywordSuggestions, ...functionSuggestions];

        if (suggestions.length > 0) {
            autocompletePopup = document.createElement('div');
            autocompletePopup.className = 'autocomplete-popup';

            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                const boldedPart = suggestion.value.substring(0, currentWord.length);
                const remainingPart = suggestion.value.substring(currentWord.length);
                const icon = suggestion.type === 'function' ? '\uea8c' : '\ueb62';
                item.innerHTML = `<span class="autocomplete-icon">${icon}</span><strong>${boldedPart}</strong>${remainingPart}`;
                item.dataset.suggestion = suggestion.value;
                item.dataset.suggestionType = suggestion.type;
                if (suggestion.description) {
                    item.dataset.description = suggestion.description;
                }
                if (index === 0) {
                    item.classList.add('selected');
                    showAutocompleteDocTooltip(item);
                }
                item.addEventListener('click', () => {
                    insertSuggestion(suggestion.value, suggestion.type, codeEditor);
                });
                item.addEventListener('mouseenter', () => {
                    showAutocompleteDocTooltip(item);
                });
                item.addEventListener('mouseleave', () => {
                    hideAutocompleteDocTooltip();
                });
                autocompletePopup.appendChild(item);
            });

        const cursorCoords = getCursorCoords(codeEditor);
        autocompletePopup.style.left = `${cursorCoords.x}px`;
        autocompletePopup.style.top = `${cursorCoords.y + 20}px`;

        document.body.appendChild(autocompletePopup);
    } else {
        hideAutocompleteDocTooltip();
    }
}

function insertSuggestion(suggestion, suggestionType, codeEditor) {
    const cursorPosition = codeEditor.selectionStart;
    const textBeforeCursor = codeEditor.value.substring(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).pop();
    const textAfterCursor = codeEditor.value.substring(cursorPosition);

    let newText = textBeforeCursor.substring(0, textBeforeCursor.length - currentWord.length) + suggestion;
    let newCursorPosition = cursorPosition - currentWord.length + suggestion.length;

    if (suggestionType === 'function') {
        newText += '()';
        newCursorPosition += 1; // Move cursor inside the parentheses
    }

    newText += textAfterCursor;
    codeEditor.value = newText;
    updateHighlighting(newText, codeEditor);

    if (autocompletePopup) {
        autocompletePopup.remove();
        autocompletePopup = null;
    }

    codeEditor.focus();
    codeEditor.selectionEnd = newCursorPosition;
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

    const selectedItem = items[selectedIndex];
    showAutocompleteDocTooltip(selectedItem);
}

let autocompleteDocTooltip = null;

function showAutocompleteDocTooltip(item) {
    hideAutocompleteDocTooltip();

    const description = item.dataset.description;
    if (!description) return;

    autocompleteDocTooltip = document.createElement('div');
    autocompleteDocTooltip.className = 'autocomplete-doc-tooltip';
    autocompleteDocTooltip.textContent = description;
    document.body.appendChild(autocompleteDocTooltip);

    const itemRect = item.getBoundingClientRect();
    autocompleteDocTooltip.style.left = `${itemRect.right + 10}px`;
    autocompleteDocTooltip.style.top = `${itemRect.top}px`;
}

function hideAutocompleteDocTooltip() {
    if (autocompleteDocTooltip) {
        autocompleteDocTooltip.remove();
        autocompleteDocTooltip = null;
    }
}

export function updateHighlighting(code, codeEditor, highlightingArea, highlightingLayer) {
    if (typeof code !== 'string') {
        code = codeEditor.value;
    }
    const validator = new Validator(code);
    lastParseResult = validator.validate(); // Use validator instead of parser
    const prog = lastParseResult.ast;
    const text = new SpannableText(code);

    prog.forEach(stmt => {
        if (!stmt) return;
        if (stmt.type === 'print') {
            if (stmt.kw) highlightToken(text, stmt.kw, 'tok-kw');
            if (stmt.expr) highlightExpr(text, stmt.expr);
        } else if (stmt.type === 'func-call') {
            if (stmt.name) highlightToken(text, stmt.name, 'tok-func-call');
            if (stmt.args) {
                stmt.args.list.forEach(arg => highlightExpr(text, arg));
            }
        }
    });

    lastParseResult.errors.forEach(err => {
        text.error(err.start.index, err.end.index);
    });

    const bracketMap = {
        '(': ')', ')': '(',
        '[': ']', ']': '[',
        '{': '}', '}': '{'
    };
    const openBrackets = ['(', '[', '{'];
    const closeBrackets = [')', ']', '}'];
    const MAX_DEPTH = 4;
    let bracketDepth = 0;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (openBrackets.includes(char)) {
            text.color(i, i + 1, `tok-bracket-depth-${bracketDepth % MAX_DEPTH}`);
            bracketDepth++;
        } else if (closeBrackets.includes(char)) {
            if (bracketDepth > 0) {
                bracketDepth--;
            }
            text.color(i, i + 1, `tok-bracket-depth-${bracketDepth % MAX_DEPTH}`);
        }
    }

    const cursorPosition = codeEditor.selectionStart;
    const charBeforeCursor = code[cursorPosition - 1];
    const charAtCursor = code[cursorPosition];

    let bracketToHighlight = -1;

    if (bracketMap[charBeforeCursor]) {
        bracketToHighlight = cursorPosition - 1;
    } else if (bracketMap[charAtCursor]) {
        bracketToHighlight = cursorPosition;
    }

    if (bracketToHighlight !== -1) {
        const matchingBracket = findMatchingBracket(code, bracketToHighlight);
        if (matchingBracket !== -1) {
            text.color(bracketToHighlight, bracketToHighlight + 1, 'tok-bracket-highlight');
            text.color(matchingBracket, matchingBracket + 1, 'tok-bracket-highlight');
        }
    }

    if (highlightingLayer) {
        highlightingLayer.innerHTML = text.toString();
    }

    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}