import SpannableText from "./spannable-text.js";
import { BaseEditor } from "./base.js";
import DocToolTipManager from "./doc-tooltip.js";
import { AutoCompletionManager } from "./completion.js";

const PAIRS = {
    "(": ")",
    "{": "}",
    "[": "]",
    '"': '"',
    "'": "'",
}

export default class Editor extends BaseEditor {
    #completer
    #doc
    #textarea
    #errTooltip
    #server
    #lastInputEvent

    constructor() {
        super()

        this.enableFeature(Editor.FEATURE.HTML)
        this.enableFeature(Editor.FEATURE.HIGHLIGHT_CURRENT_LINE)
        this.enableFeature(Editor.FEATURE.LINE_NUMBER)
        this.enableFeature(Editor.FEATURE.TAB)

        this.#textarea = this.shadowRoot.querySelector("textarea")
        this.#errTooltip = this.shadowRoot.querySelector(".error-tooltip")

        this.#completer = new AutoCompletionManager(this,
            this.shadowRoot.querySelector(".completion"))

        this.#doc = new DocToolTipManager(this.shadowRoot.querySelector(".doc-tooltip"))

        // this.valueListener = (val) => this.#setValue(val, { update: { } })
    }

    connectedCallback() {
        super.connectedCallback()

        this.#completer.init(this.#doc);

        this.#textarea.addEventListener("beforeinput", ev => {
            if (ev.inputType === "insertText") {
                if (Object.values(PAIRS).includes(ev.data)) {
                    if (this.text[this.cursor.index] === ev.data) {
                        ev.preventDefault()
                        this.cursor.index++
                    }
                }
            }

            if (ev.inputType === "insertLineBreak") {
                const line = this._getLines()[this.cursor.line]
                const tab = line.match(/^\t*/)[0]

                const left = this.text[this.cursor.index - 1]
                const right = this.text[this.cursor.index]

                ev.preventDefault()

                if (left in PAIRS && right === PAIRS[left]) {
                    this.insertAtCursor(`\n${tab}\t\n${tab}`)
                    this.cursor.index -= tab.length + 1
                } else {
                    this.insertAtCursor(`\n${tab}`)
                }
            }
        })

        this.#textarea.addEventListener("input", ev => {
            this.#lastInputEvent = ev

            // if (this.outputStream) {
            //     if (ev.inputType === "insertText") {
            //         this.#setValue(this.value.slice(0, -ev.data.length));
            //     }

            //     this.outputStream.write(ev.data);

            //     return;
            // }
            // if (!this._onInput(ev)) {
            //     ev.preventDefault()
            // }

            if (ev.inputType === "insertText") {
                if (this.#server && /^[a-zA-Z0-9_.]$/.test(ev.data.at(-1))) {
                    this.#hideError()
                    this.#completer.show(this.#server.completions());
                }
            }

        })

        this.#textarea.addEventListener("keydown", ev => {
            this._lastInputEvent = null
            
            if (ev.ctrlKey) {
                switch(ev.key) {
                    case "i":
                        if (!this.#server) break

                        this.#server.cursorIndex = this.cursor.index;

                        this.#doc.showAt(
                            this.#server.doc(),
                            this.cursor.x - 10,
                            innerHeight - this.cursor.y,
                            "bottom",
                        )

                        break

                    case "x": {
                        if (this.cursor.isSelecting) break

                        ev.preventDefault()

                        const lines = this._getLines()

                        let start = 0
                        let end

                        for (let i = 0; i < lines.length; i++){
                            if (this.cursor.line === i) {
                                end = start + lines[i].length + 1
                                break
                            }

                            start += lines[i].length + 1
                        }

                        this.deleteRange(start, end)
                    }

                    case "c": {
                        if (this.cursor.isSelecting) break

                        ev.preventDefault()

                        const line = this._getLines()[this.cursor.line]
                        navigator.clipboard.writeText(line)
                    }
                }
            }

            if (ev.key === "Backspace") {
                const left = this.text[this.cursor.index - 1]

                if (left in PAIRS) {
                    if (this.text[this.cursor.index] === PAIRS[left]) {
                        ev.preventDefault()
                        this.deleteRange(this.cursor.index - 1, this.cursor.index + 1)
                    }
                }
            }

            
            // if (this.#doc.is_visible) {
            //     this.#doc.hide();
            // }
        })

        this.onselectionchange = () => {
            if (!this.#server) return

            this.#server.cursorIndex = this.cursor.index
            const errMsg = this.#server.error();

            if (errMsg) {
                this.#showError(errMsg);
            } else {
                this.#hideError();
            }
        }
    }

    _onKeyDown(ev) {
        // if (ev.key === "Tab") {
        //     if (this.#completer.isVisible) {
        //         this.#completer.complete()
        //         return true
        //     }
        // }
        // return false
    }

    set server(server) {
        this.#server = server;

        if (!server) return;

        server.match = (start, end) => {
            if (this.text[this.cursor.index] === end) return
            if (this.text[this.cursor.index - 1] !== start) return
            if (this._lastInputEvent?.inputType !== "insertText") return

            this.insertAtCursor(end)
            this.cursor.index--
        }
    }

    _getHighlightedLines() {
        if (!this.#server) return super._getHighlightedLines()

        const span = new SpannableText(this.text)
        
        this.#server.cursorIndex = this.cursor.index

        this.#server.lint(span, this)

        return span.toString().split("\n")
    }

    #showError(msg) {
        this.#errTooltip.innerText = msg;
        this.#errTooltip.style.display = "inline-block";

        const rect = this.#errTooltip.getBoundingClientRect();

        const cursorY = this.#getLineHeight() * this.cursor.line

        if (rect.height > cursorY) {
            if (this.#completer.isVisible) {
                this.#hideError()
                return
            }

            this.#errTooltip.style.top = `${(this.cursor.line + 1) * 1.5}em`;
            this._errorSide = "bottom"
        } else {
            this.#errTooltip.style.top = `calc(${this.cursor.line * 1.5}em - ${rect.height}px)`
            this._errorSide = "top"
        }

        const cursorX = this.#getColumnSize() * this.cursor.column

        if (cursorX > innerWidth / 2) {
            this.#errTooltip.style.left = `calc(${this.cursor.column}ch - ${rect.width}px)`
        } else {
            this.#errTooltip.style.left = `calc(${this.cursor.column}ch)`
        }
    }

    #hideError(msg) {
        this.#errTooltip.style.display = "none";
    }

    #getLineHeight() {
        const style = getComputedStyle(this.#textarea)
        return parseFloat(style.lineHeight)
    }

    #getColumnSize() {
        const style = getComputedStyle(this.#textarea)
        const span = document.createElement("span")

        span.style.font = style.font
        span.style.fontSize = style.fontSize
        // span.style.whiteSpace = "pre"
        span.textContent = '0'

        document.body.appendChild(span)
        const charWidth = span.getBoundingClientRect().width
        document.body.removeChild(span)

        return charWidth
    }
}

customElements.define("code-editor", Editor);
