import { Mutable } from "../core.js"
import Cursor from "./cursor.js"
import styles from "./style.css" with { type: "css" }

const EDIT_DEFAULT_OPTIONS = {
    history: true
}

export class BaseEditor extends HTMLElement {
    static FEATURE = {
        HTML:                   1,
        HIGHLIGHT_CURRENT_LINE: 2,
        LINE_NUMBER:            3,
        TAB:                    4,
    }

    #onMutate = value => {
        this._setText(value)
    }

    #enabledFeatures = new Set()
    #undos = []
    #redos = []

    #textarea
    #pre
    #lineno
    #editor

    #mutable
    #lines
    #linedLines
    
    constructor() {
        super()

        this.attachShadow({ mode: "open" })

        this.shadowRoot.innerHTML = `
            <div class="wrapper">
                <div class="lineno"></div>

                <div class="editor">
                    <textarea></textarea>
                    <pre></pre>
                </div>
                
                <div class="error-tooltip"></div>
                <div class="completion"></div>
                
                <div class="doc-tooltip">
                    <div class="symbol"></div>
                    <div class="doc"></div>
                </div>
            </div>
        `

        this.shadowRoot.adoptedStyleSheets.push(styles)

        this.#textarea = this.shadowRoot.querySelector("textarea")
        this.#pre      = this.shadowRoot.querySelector("pre")
        this.#lineno   = this.shadowRoot.querySelector(".lineno")
        this.#editor   = this.shadowRoot.querySelector(".editor")

        this.cursor = new Cursor(this.#textarea)
    }

    connectedCallback() {
        this.#textarea.addEventListener("beforeinput", ev => {
        
        })

        this.#textarea.addEventListener("input", ev => {
            this._lastInputEvent = ev
            this.#redos = []

            if (ev.inputType === "insertText") {
                  this.#undos.push({
                      type: "insert",
                      value: ev.data,
                      index: this.cursor.index - ev.data.length
                  })
            }

            if (ev.inputType === "insertLineBreak") {
                this.#undos.push({
                    type: "insert",
                    value: '\n',
                    index: this.cursor.index - 1
                })
            }

            // if (ev.inputType === "deleteContentBackward") {
            //     this.#undo.push({
            //         type: "delete-backward",
            //         index: this.cursor.index + 1
            //     })
            // }
            
            if (this.#mutable) {
                this.#mutable.value = this.text
                this._onTextChange()
            }
        })

        this.#textarea.addEventListener("keydown", ev => {
            console.log("KeyDown from BaseEditor", ev)

            if (this._onKeyDown?.(ev)) {
                return
            }

            if (ev.key == "Tab") {
                if (!this.#enabledFeatures.has(BaseEditor.FEATURE.TAB)) return

                ev.preventDefault()
                this.insertAtCursor('\t')
            }

            if (ev.ctrlKey) {
                console.log("Ctrl", ev)
                if (ev.key === "z") {
                    ev.preventDefault()
                    console.log(JSON.stringify(this.#undos))
                    this.#undo()
                }

                if (ev.key === "y") {
                    ev.preventDefault()
                    this.#redo()
                }
            }

            if (ev.key === "Backspace") {
                this.#undos.push({
                    type: "delete-backward",
                    value: this.text[this.cursor.index - 1],
                    index: this.cursor.index
                })

                this.#redos = []
            }
        })
        // this.#textarea.onkeyup = () => {
        //     if (this.#enabledFeatures.has(BaseEditor.FEATURE.HTML)) {
        //         // this._onTextChange()
        //     }
        // }

        this.#textarea.onscroll = () => {
            this.#pre.scrollLeft = this.#textarea.scrollLeft
        }

        document.addEventListener("selectionchange", () => {
            if (document.activeElement === this) {
                this.cursor._update(this)
                this.#pre.innerHTML = this.#getHtml()

                this.onselectionchange?.()
            }
        })
    }

    set text(data) {
        this.#undos = []
        this.#redos = []

        if (this.#mutable) {
            this.#mutable.unsubscribe(this.#onMutate)
            this.#mutable = null
        }
        
        if (data instanceof Mutable) {
            this.#mutable = data
            this.#mutable.subscribe(this.#onMutate)
        } else {
            this.#textarea.value = data
        }
    }

    /** @returns {string} */
    get text() {
        return this.#textarea.value
    }

    insertAt(index, text, opt = {}) {
        if (!text) return

        const left = this.text.slice(0, index)
        const right = this.text.slice(index)

        opt = Object.assign({...EDIT_DEFAULT_OPTIONS}, opt)

        this._setText(left + text + right)
        this.cursor.index = index + text.length

        if (!opt.history) return

        this.#undos.push({
            type: "insert",
            value: text,
            index
        })

        this.#redos = []
    }

    insertAtCursor(text) {
        this.insertAt(this.cursor.index, text)
    }

    deleteForeward(count, opt = {}) {
        if (count < 1) return

        const left = this.text.slice(0, this.cursor.index)
        const right = this.text.slice(this.cursor.index + count)
        const index = this.cursor.index

        opt = Object.assign({...EDIT_DEFAULT_OPTIONS}, opt)

        if (!opt.history) return

        this._setText(left + right)
        this.cursor.index = index
    }

    deleteBackward(count, opt = {}) {
        if (count < 1) return

        const left = this.text.slice(0, this.cursor.index - count)
        const right = this.text.slice(this.cursor.index)
        const index = this.cursor.index

        opt = Object.assign({...EDIT_DEFAULT_OPTIONS}, opt)

        if (!opt.history) return

        this._setText(left + right)
        this.cursor.index = index
    }

    deleteRange(start, end, opt = {}) {
        if (start == end) return

        if (start > end) {
            start = start ^ end
            end = start ^ end
            start = start ^ end
        }

        const left = this.text.slice(0, start)
        const right = this.text.slice(end)
        const value = this.text.slice(start, end)

        opt = Object.assign({...EDIT_DEFAULT_OPTIONS}, opt)

        this._setText(left + right)
        this.cursor.index = start

        if (!opt.history) return
        
        this.#undos.push({
            type: "delete-range",
            value: value,
            index: start
        })

        this.#redos = []
    }

    disable() {
        this.#textarea.disabled = true
    }

    enable() {
        this.#textarea.disabled = false
    }

    enableFeature(feature) {
        this.#enabledFeatures.add(feature)

        switch (feature) {
            case BaseEditor.FEATURE.HTML:
                this.#pre.style.display = "block"
                this.#textarea.style.color = "transparent"
                break

            case BaseEditor.FEATURE.LINE_NUMBER:
                this.#lineno.style.display = "block"
                break
        }
    }

    disableFeature(feature) {
        this.#enabledFeatures.delete(feature)

        switch(feature) {
            case BaseEditor.FEATURE.HTML:
                this.#pre.style.display = "none"
                this.#textarea.style.color = "inherit"
                break

            case BaseEditor.FEATURE.LINE_NUMBER:
                this.#lineno.style.display = "none"
                break
        }
    }

    #undo() {
        const action = this.#undos.pop()    
        console.log(action)

        if (!action) return

        if (action.type === "insert") {
            this.deleteRange(action.index, action.index + action.value.length,
                { history: false })
        }

        if (action.type === "delete-backward") {
            this.insertAt(action.index - 1, action.value, { history: false })
        }
        
        if (action.type === "delete-range") {
            this.insertAt(action.index + 1, action.value, { history: false })
        }

        this.#redos.push(action)
    }

    #redo() {
        const action = this.#redos.pop()    

        if (!action) return

        if (action.type === "insert") {
            this.insertAt(action.index, action.value, { history: false })
        }

        if (action.type === "delete-backward") {
            this.deleteRange(action.index - 1, action.index, { history: false })
        }

        this.#undos.push(action)
    }
    
    /**
     * @returns {string[]} htmls encoded
     */
    _getHighlightedLines() {
        return this._getLines().map(line => {
            return (line || " ")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
        })
    }

    #getLinedLines() {
        if (this.#linedLines) return this.#linedLines
        return this.#linedLines = this._getHighlightedLines()
    }

    #getHtml() {
        const lines = this.#getLinedLines()
        const newLines = []

        this.#lineno.innerHTML = ""

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i] || ' '
            // const lineno = i + 1

            if (this.cursor.lineno === i && this.#enabledFeatures.has(BaseEditor.FEATURE.HIGHLIGHT_CURRENT_LINE)) {
                newLines.push(`<div class="cur-line">${line}</div>`)

                if (this.#enabledFeatures.has(BaseEditor.FEATURE.LINE_NUMBER)) {
                    this.#lineno.innerHTML += `<div class="cur-line">${i + 1}</div>`
                }
            } else {
                newLines.push(`<div class="line">${line}</div>`)

                if (this.#enabledFeatures.has(BaseEditor.FEATURE.LINE_NUMBER)) {
                    this.#lineno.innerHTML += `<div class="line">${i + 1}</div>`
                }
            }

        }

        return newLines.join("")
    }

    _onTextChange() {
        this.#lines = null
        this.#linedLines = null
        // this.cursor._update(this._getLines())
        this.#pre.innerHTML = this.#getHtml()
        this._updateHeight()
    }
    
    _getLines() {
        if (this.#lines) return this.#lines
        return this.#lines = this.text.split('\n')
    }

    _updateHeight() {
        const rect = this.#pre.getBoundingClientRect()
        const rootRect = this.getBoundingClientRect()

        this.#textarea.style.height = Math.max(rect.height, rootRect.height) + "px"
    }

    _setText(text) {
        this.#textarea.value = text

        if (this.#enabledFeatures.has(BaseEditor.FEATURE.HTML)) {
            this._onTextChange()
        }
    }
}
