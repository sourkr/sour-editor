import SpannableText from "../spannable-text.js"
import { Mutable } from './core.js'

const TYPE_CODES = {
    func: '\uea8c',
    kw: '\ueb62',
    type: '\ueb62',
    var: '\uea88'
}

class Editor extends HTMLElement {
    #completer
    #doc
    
    #lineno
    #textarea
    #pre
    #errTooltip

    #server
    #lastInputEvent
    
    constructor() {
        super()
        
        this.attachShadow({ mode: "open" })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    font-family: inherit;
                    width: fit-content;
                    height: fit-content;
                    background: inherit;
                    color: inherit;
                    padding: 10px 10px 10px 0;
                    font-size: 16px;
                    border-color: inherit;
                }
                
                .wrapper {
                    width: 100%;
                    height: 100%;
                    display: flex;
                }
                
                .lineno {
                    padding-inline: 10px 10px;
                    font-size: inherit;
                    color: grey;
                    text-align: end;
                    line-height: 1.5;
                }
                
                .editor {
                    position: relative;
                    flex: 1;
                }
                
                textarea, pre {
                    padding: 0;
                    margin: 0;
                    font-family: inherit;
                    outline: none;
                    border: none;
                    font-size: inherit;
                    width: 100%;
                    height: 100%;
                    line-height: 1.5;
                    font-weight: normal;
                    box-sizing: border-box;
                    tab-size: 4;
                }
                
                textarea {
                    position: absolute;
                    resize: none;
                    color: transparent;
                    background: transparent;
                    top: 0;
                    padding-left: 5px;
                    caret-color: white;
                }
                
                pre {
                    color: inherit;
                    background: inherit;
                }
                
                .cur-line {
                    background: hsl(0deg, 0%, 100%, .05);
                    padding-left: 5px;
                }
                
                .line {
                    padding-left: 5px;
                }
                
                .tok-kw {
                    color: #C586C0;
                }
                
                .tok-def {
                    color: #569CD6;
                }
                
                .tok-type {
                    color: #4EC9B0;
                }
                
                .tok-num {
                    color: #B5CEA8;
                }
                
                .tok-var {
                    color: #9CDCFE;
                }
                
                .tok-func-call {
                    color: #DCDCAA;
                }
                
                .tok-bracket-depth-0 {
                    color: #FFD700; /* Gold */
                }

                .tok-bracket-depth-1 {
                    color: #FF69B4; /* HotPink */
                }

                .tok-bracket-depth-2 {
                    color: #6fabdc; /* LightSkyBlue */
                }

                .tok-bracket-depth-3 {
                    color: #ADFF2F; /* GreenYellow */
                }
                
                .tok-str {
                    color: #CE9178;
                }

                .tok-char {
                    color: #98C379;
                }
                
                .tok-bracket-lit {
                    background-color: hsl(0deg, 0%, 100%, .2);
                    border-radius: 3px;
                    box-sizing: border-box;
                }
                
                .tok-err {
                    display: inline-block;
                    text-decoration: underline;
                    text-decoration-style: wavy;
                    text-decoration-color: red;
                }
                
                .dim {
                    filter: brightness(60%);
                }
                
                .tab {
                    border-left: 1px solid grey;
                }
                
                .error-tooltip {
                    position: absolute;
                    background: var(--tooltip-background);
                    height: fit-content;
                    border: 1px solid red;
                    padding: 5px;
                    margin: 10px;
                    display: none;
                    pointer-events: none;
                }
                
                .completion {
                    position: absolute;
                    background: var(--tooltip-background);
                    border: 1px solid grey;
                    margin: 10px;
                    display: none;
                    flex-direction: column;
                    
                    & div {
                        padding-inline: 5px;
                    }
                }
                
                .doc-tooltip {
                    position: absolute;
                    background: var(--tooltip-background);
                    border: 1px solid;
                    border-color: grey;
                    margin-inline: 10px;
                    display: none;
                    right: 0;
                    
                    .symbol {
                        padding: 5px;
                    }
                    
                    .doc {
                        padding: 5px;
                        border-top: 1px solid grey;
                    }
                }
                
                .prefix {
                    font-weight: bold;
                }
            </style>
            
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
        
        this.#lineno = this.shadowRoot.querySelector('.lineno')
        this.#textarea = this.shadowRoot.querySelector('textarea')
        this.#pre = this.shadowRoot.querySelector('pre')
        this.#errTooltip = this.shadowRoot.querySelector('.error-tooltip')
        
        this.#completer = new AutoCompletionManager(this,this.shadowRoot.querySelector('.completion'))
        this.#doc = new DocToolTipManager(this.shadowRoot.querySelector('.doc-tooltip'))
        
        this.valueListener = val => this.#setValue(val, { update: true })
    }
    
    connectedCallback() {
        this.#completer.init(this.#doc)
        this.#doc.init(this.#completer)
        
        this.#lineno.innerText = '1'
        
        this.#textarea.oninput = ev => {
            
            this.#lastInputEvent = ev
            
            if (this.outputStream) {
                if (ev.inputType === 'insertText') {
                    this.#setValue(this.value.slice(0, -ev.data.length))
                }
                
                this.outputStream.write(ev.data)

                return
            }
            
            if (this.mutabelValue) {
                this.mutabelValue.value = this.value
            }
        }
        
        this.#textarea.onkeydown = ev => {
            this.#lastInputEvent = null
            
            if (ev.key == 'Tab') {
                ev.preventDefault()
                this.insert('\t')
            }
        }
        
        this.#textarea.onkeyup = this.#update.bind(this)
        this.#textarea.onclick = this.#update.bind(this)
    }
    
    set value(val) {
        if (this.mutableValue) {
            this.mutabelValue.unsubscribe(this.valueListener)
            this.mutableValue = null
        }
        
        if (val instanceof Mutable) {
            this.mutabelValue = val
            val.subscribe(this.valueListener)
        } else {
            this.#textarea.value = val
            this.#update()
        }
    }
    
    get value() {
        return this.#textarea.value
    }
    
    #setValue(val, option = {}) {
        if (this.mutableValue && option.mutate) {
            this.mutableValue.value = val
        }
        
        const cursorIndex = this.cursorIndex
        this.#textarea.value = val
        this.cursorIndex = cursorIndex
        
        if (option.update) {
            this.#update()
        }
    }
    
    get cursorIndex() {
        return this.#textarea.selectionStart || 0
    }
    
    set cursorIndex(val) {
        this.#textarea.selectionStart = this.#textarea.selectionEnd = val
    }
    
    insert(text) {
        const left = this.value.slice(0, this.cursorIndex)
        const right = this.value.slice(this.cursorIndex)
        const cursorIndex = this.cursorIndex
        
        this.#setValue(left + text + right, {
            mutate: true,
            update: true
        })
        
        this.cursorIndex = cursorIndex + text.length
    }
    
    disable() {
        this.#textarea.disabled = true
        this.#errTooltip.style.display = 'none'
        this.#completer.hide()
    }
    
    enable() {
        this.#textarea.disabled = false
    }
    
    disableLineNo() {
        this.#lineno.style.display = 'none'
    }
    
    enableLineNo() {
        this.#lineno.style.display = 'block'
    }
    
    set server(server) {
        this.#server = server
        
        if (!server) return
        
        server.match = (start, end) => {
            if (this.#lastInputEvent?.inputType != 'insertText' || this.#lastInputEvent.data != start) return
            if (this.value[this.cursorIndex] === end) return
                
            this.addEventListener('updated', () => {
                this.insert(end)
                this.cursorIndex--
            }, { once: true })
        } 
    }
    
    get cursorY() {
        const rect = this.shadowRoot.querySelector('.cur-line')?.getBoundingClientRect()
        return rect?.y || 0
    }
    
    get cursorX() {
        const cursorIndex = this.cursorIndex;
        const text = this.value;
        const lines = text.split('\n');
    
        // Find current line and column
        let currentLine = 0;
        let currentCol = 0;
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (cursorIndex >= count && cursorIndex <= count + line.length) {
                currentLine = i;
                currentCol = cursorIndex - count;
                break;
            }
                count += line.length + 1; // +1 for newline character
        }
        
        const currentLineElement = this.shadowRoot.querySelector('.cur-line');
        if (!currentLineElement) return 0;

        // Create range to measure cursor position
        const range = document.createRange();
        const walker = document.createTreeWalker(
            currentLineElement,
            NodeFilter.SHOW_TEXT,
            null
        );
    
        let totalChars = 0;
        let startNode = null;
        let startOffset = 0;
    
        // Find text node containing cursor position
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;
            if (currentCol <= totalChars + nodeLength) {
                startNode = node;
                startOffset = currentCol - totalChars;
                break;
            }
            totalChars += nodeLength;
        }
    
        // Set range position
        if (startNode) {
            range.setStart(startNode, startOffset);
        } else {
            // Handle case where cursor is at end of line
            range.selectNodeContents(currentLineElement);
            range.collapse(false);
        }
    
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        return rect.left;
    }
    
    #update(ev) {
        const code = this.#textarea.value
        const lines = code.split('\n')
        
        const span = new SpannableText(code)
        
        if (this.#server) {
            this.#server.cursorIndex = this.cursorIndex
            this.#server.lint(span, this)
            
            const errMsg = this.#server.error()
            
            if (errMsg) {
                this.#showError(errMsg)
            } else {
                this.#hideError()
            }
            
            if (ev?.key === 'Unidentified') {
                this.#completer.show(this.#server.completions())
            }
        }
        
        const hlLines = span.toString().split('\n')
        
        const currentLineNo = this.#getCurrentLineNo(lines)
        
        const linesTop = hlLines.slice(0, currentLineNo - 1).map(line => `<div class="line">${line || ' '}</div>`)
        const currentLine = `<div class="cur-line">${hlLines[currentLineNo - 1] || ' '}</div>`
        const linesBottom = hlLines.slice(currentLineNo).map(line => `<div class="line">${line || ' '}</div>`)
            
        this.#pre.innerHTML = [...linesTop, currentLine, ...linesBottom].join('')
            
        this.#lineno.innerText = lines.map((_, i) => i + 1)
            .join('\n')
        
        const event = new CustomEvent('updated')
        this.dispatchEvent(event)
    }
    
    #getCurrentLineNo(lines) {
        const cursorIndex = this.#textarea.selectionStart
        let lineStart = 0
        
        for(let i = 0; i < lines.length; i++) {
            if (cursorIndex < lineStart) return i
            lineStart += lines[i].length + 1
        }
        
        return lines.length;
    }
    
    #showError(msg) {
        this.#errTooltip.innerText = msg
        this.#errTooltip.style.display = 'inline-block'
        
        const rect = this.#errTooltip.getBoundingClientRect()
        
        if (rect.height >= this.cursorY) {
            this.#errTooltip.style.top = `${this.cursorY}px`
        } else {
            this.#errTooltip.style.top = `${this.cursorY - rect.height - 10}px`
        }
        
        if (this.cursorX < (innerWidth / 3)) {
            this.#errTooltip.style.left = `0`
            this.#errTooltip.style.translateX = `0`
            this.#errTooltip.style.right = 'auto'
        } else if (this.cursorX > (innerWidth * .75)) {
            this.#errTooltip.style.left = `auto`
            this.#errTooltip.style.translateX = `0`
            this.#errTooltip.style.right = `0`
        } else {
            this.#errTooltip.style.left = `50%`
            this.#errTooltip.style.translateX = `-50%`
            this.#errTooltip.style.right = `auto`
        }
    }
    
    #hideError(msg) {
        this.#errTooltip.style.display = 'none'
    }
}


class AutoCompletionManager {
    isVisible = false
    
    constructor(editor, completion) {
        this.editor = editor
        this.completion = completion
    }
    
    init(doc) {
        this.doc = doc
        
        window.addEventListener('keydown', ev => {
            if (!this.isVisible) return
            
            if (ev.key === 'Enter') {
                ev.preventDefault()
                ev.stopPropagation()
                
                this.complete(this.itemList[this.selected])
                return
            }
            
            if (ev.key === 'ArrowDown') {
                ev.preventDefault()
                ev.stopPropagation()
                
                this.selected = Math.max(0, Math.min(this.itemList.length - 1, this.selected + 1))
                
                this.itemList.forEach((item, i) => {
                    if (i === this.selected) {
                        item.layout.style.background = 'hsla(200deg, 100%, 50%, .5)'
                        this.doc.show(item.doc)
                    } else {
                        item.layout.style.background = 'transparent'
                    }
                })
                
                return
            }
            
            if (ev.key === 'ArrowUp') {
                ev.preventDefault()
                ev.stopPropagation()
                
                this.selected = Math.max(0, Math.min(this.itemList.length - 1, this.selected - 1))
                
                this.itemList.forEach((item, i) => {
                    if (i === this.selected) {
                        item.layout.style.background = 'hsla(200deg, 100%, 50%, .5)'
                        this.doc.show(item.doc)
                    } else {
                        item.layout.style.background = 'transparent'
                    }
                })
                
                return
            }
            
            this.hide()
        })
    }
    
    show(itemList) {
        this.isVisible = true
        this.itemList = itemList
        this.selected = 0
        
        if (!itemList?.length) {
            this.hide()
            return
        }
        
        this.completion.innerHTML = ''
        this.completion.style.display = 'flex'
        
        this.completion.style.top = `calc(${this.editor.cursorY}px + 1em)`
        this.completion.style.left = `calc(${this.editor.cursorX}px - 1em)`
        
        itemList.forEach((item, i) => {
            const layout = item.layout = document.createElement('div')
            const text = `${TYPE_CODES[item.type]} <span class="prefix">${item.prefix}</span>${item.name.slice(item.prefix.length)}`
            
            layout.innerHTML = text
            this.completion.append(layout)
            
            if (i == 0) {
                layout.style.background = 'hsla(200deg, 100%, 50%, .5)'
                this.doc.show(item.doc)
            }
            
            layout.onclick = () => this.complete(item)
        })
    }
    
    complete(item) {
        if (item.type == 'func') {
            this.editor.insert(`${item.name.slice(item.prefix.length)}()`)
            if (item.doc.params.length) this.editor.cursorIndex--
        } else if (item.type == 'kw') {
            this.editor.insert(`${item.name.slice(item.prefix.length)} `)
        } else {
            this.editor.insert(item.name.slice(item.prefix.length))
        }
        
        this.hide()
    }
    
    hide() {
        this.isVisible = false
        this.completion.style.display = 'none'
        this.doc.hide()
    }
    
    get rect() {
        return this.completion.getBoundingClientRect()
    }
}


class DocToolTipManager {
    constructor(tooltip) {
       this.tooltip = tooltip
       this.symbol = tooltip.querySelector('.symbol')
       this.doc = tooltip.querySelector('.doc') 
    }
   
    init(completion) {
        this.completion = completion
    }
    
    show(type) {
        if (!type) return
        
        this.symbol.innerHTML = this.toStringType(type)
        
        this.doc.innerHTML = this.formatDocComment(type.doc)
        
        this.tooltip.style.display = 'block'
        
        this.tooltip.style.top = `${this.completion.rect.top}px`
        this.tooltip.style.left = `${this.completion.rect.right}px`
    }

    formatDocComment(docString) {
        if (!docString) return '';

        // Remove JSDoc block start/end and leading asterisks
        const cleanedDoc = docString
            .replace(/^\/\*\*\s*/, '') // Remove /** at the beginning
            .replace(/\s*\*\/$/, '')   // Remove */ at the end
            .split('\n')
            .map(line => line.replace(/^\s*\*\s?/, '').trim()) // Remove leading * and trim
            .filter(line => line !== ''); // Remove empty lines

        let description = [];
        let params = [];
        let returns = '';

        for (const line of cleanedDoc) {
            if (line.startsWith('@param')) {
                params.push(line.substring('@param'.length).trim());
            } else if (line.startsWith('@returns')) {
                returns = line.substring('@returns'.length).trim();
            } else {
                description.push(line);
            }
        }

        let html = '';
        if (description.length > 0) {
            html += `<p>${description.join('<br>')}</p>`;
        }

        if (params.length > 0) {
            html += '<h4>Parameters:</h4><ul>';
            for (const param of params) {
                // Expected format: {paramName} {description}
                const match = param.match(/^(\S+)\s+(.*)/);
                if (match) {
                    html += `<li><strong>${match[1]}</strong>: ${match[2]}</li>`;
                } else {
                    html += `<li>${param}</li>`;
                }
            }
            html += '</ul>';
        }

        if (returns) {
            html += `<h4>Returns:</h4><p>${returns}</p>`;
        }

        return html;
    }
    
    hide() {
        this.tooltip.style.display = 'none'
    }
    
    toStringType(type) {
        if (type.type === 'func') {
            const kw = this.span('tok-kw', 'func')
            const name = this.span('tok-func-call', type.name)
            
            const params = type.params
                .map(param => `${this.span('tok-var', param.name)}: ${this.span('tok-type', param.type.name)}`)
                .join(',')
                
            return `${kw} ${name}(${params}): ${this.span('tok-type', type.retType.name)}`
        }
        
        if (type.type == 'simple') {
            if (type.is_param) {
                return `<span style="color:grey">(param)</span> ${this.span('tok-var', type.param_name)}: ${this.span('tok-type', type.name)}`
            }
            
            if (type.is_var) {
                return `${this.span('tok-def', 'var')} ${this.span('tok-var', type.var_name)}: ${this.span('tok-type', type.name)}`
            }
            
            return `${this.span('tok-type', type.name)}`
        }
    }
    
    span(color, data) {
        return `<span class="${color}">${data}</span>`
    }
}

customElements.define("code-editor", Editor)