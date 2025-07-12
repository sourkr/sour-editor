import Parser from "./libs/sourlang/parser.js";
import SpannableText from "./libs/spannable-text.js";

// Global variables (these could be passed as parameters or managed via a class if preferred)
let lastParseResult = null;
let autocompletePopup = null;

export function initializeEditor(codeEditor, highlightingArea, highlightingLayer) {
    // Event Listeners
    if (codeEditor) {
        codeEditor.addEventListener('input', (e) => {
            if (e.inputType === 'insertText' && e.data === '"') {
                const start = codeEditor.selectionStart;
                const end = codeEditor.selectionEnd;
                const text = codeEditor.value;
                codeEditor.value = text.substring(0, start - 1) + '""' + text.substring(end);
                codeEditor.selectionStart = codeEditor.selectionEnd = start;
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
                        insertSuggestion(selected.dataset.suggestion, codeEditor);
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

    const keywords = ['print']; // Add more keywords as needed
    const suggestions = keywords.filter(kw => kw.startsWith(currentWord));

    if (suggestions.length > 0) {
        autocompletePopup = document.createElement('div');
        autocompletePopup.className = 'autocomplete-popup';

        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            const boldedPart = suggestion.substring(0, currentWord.length);
            const remainingPart = suggestion.substring(currentWord.length);
            item.innerHTML = `<span class="autocomplete-icon">\ueb62</span><strong>${boldedPart}</strong>${remainingPart}`;
            item.dataset.suggestion = suggestion;
            if (index === 0) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => {
                insertSuggestion(suggestion, codeEditor);
            });
            autocompletePopup.appendChild(item);
        });

        const cursorCoords = getCursorCoords(codeEditor);
        autocompletePopup.style.left = `${cursorCoords.x}px`;
        autocompletePopup.style.top = `${cursorCoords.y + 20}px`;

        document.body.appendChild(autocompletePopup);
    }
}

function insertSuggestion(suggestion, codeEditor) {
    const cursorPosition = codeEditor.selectionStart;
    const textBeforeCursor = codeEditor.value.substring(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).pop();
    const textAfterCursor = codeEditor.value.substring(cursorPosition);

    const newText = textBeforeCursor.substring(0, textBeforeCursor.length - currentWord.length) + suggestion + textAfterCursor;
    codeEditor.value = newText;
    updateHighlighting(newText, codeEditor);

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

export function updateHighlighting(code, codeEditor, highlightingArea, highlightingLayer) {
    if (typeof code !== 'string') {
        code = codeEditor.value;
    }
    const parser = new Parser(code);
    lastParseResult = parser.parse();
    const prog = lastParseResult;
    const text = new SpannableText(code);

    prog.ast.forEach(stmt => {
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

    prog.errors.forEach(err => {
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

    if (highlightingLayer) {
        highlightingLayer.innerHTML = text.toString();
    }

    if (highlightingArea) {
        highlightingArea.scrollTop = codeEditor.scrollTop;
        highlightingArea.scrollLeft = codeEditor.scrollLeft;
    }
}