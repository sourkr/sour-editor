import SpannableText from "./spannable-text.js";
import { BaseEditor } from "./base.js";
import DocToolTipManager from "./doc-tooltip.js";
import { AutoCompletionManager } from "./AutoCompletionManager.js";

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
        this.enableFeature(Editor.FEATURE.LINE_NUMBER)
        this.enableFeature(Editor.FEATURE.TAB)

        // this.#lineno = this.shadowRoot.querySelector(".lineno");
        this.#textarea = this.shadowRoot.querySelector("textarea")
        // this.#pre = this.shadowRoot.querySelector("pre");
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
                if (/^[a-zA-Z0-9_.]$/.test(ev.data.at(-1))) {
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
                            if (this.cursor.lineno === i) {
                                end = start + lines[i].length + 1
                                break
                            }

                            start += lines[i].length
                        }

                        this.deleteRange(start, end)
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
            console.log("match", this.#lastInputEvent)
            if (this.text[this.cursor.index] === end) return
            if (this.text[this.cursor.index - 1] !== start) return
            if (this._lastInputEvent?.inputType !== "insertText") return

            this.insertAtCursor(end)
            this.cursor.index--
        }
    }

    _getHighlightedLines() {
        if (!this.#server) return

        const span = new SpannableText(this.text)
        
        this.#server.cursorIndex = this.cursor.index

        this.#server.lint(span, this)

        return span.toString().split("\n")
    }

    #showError(msg) {
        if (this.#completer.isVisible) return

        this.#errTooltip.innerText = msg;
        this.#errTooltip.style.display = "inline-block";

        const rect = this.#errTooltip.getBoundingClientRect();

        if (rect.height >= this.cursor.y) {
            this.#errTooltip.style.top = `calc(${this.cursor.y}px + 1.5em)`;
            this._errorSide = "bottom"
        } else {
            this.#errTooltip.style.top = `${this.cursor.y - rect.height - 10}px`;
            this._errorSide = "top"
        }

        if (this.cursor.x < innerWidth / 3) {
            this.#errTooltip.style.left = `0`;
            this.#errTooltip.style.translateX = `0`;
            this.#errTooltip.style.right = "auto";
        } else if (this.cursor.x > innerWidth * 0.75) {
            this.#errTooltip.style.left = `auto`;
            this.#errTooltip.style.translateX = `0`;
            this.#errTooltip.style.right = `0`;
        } else {
            this.rTooltip.style.left = `50%`;
            this.#errTooltip.style.translateX = `-50%`;
            this.#errTooltip.se.right = `auto`;
        }
    }

    #hideError(msg) {
        this.#errTooltip.style.display = "none";
    }
}

customElements.define("code-editor", Editor);
