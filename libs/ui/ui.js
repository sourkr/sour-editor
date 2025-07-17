import SpannableText from "../spannable-text.js"

const paths = await (await fetch('./libs/ui/paths.json')).json()

export const R = {
    drawable: new Proxy({}, {
        get(target, prop, reciver) {
            if (typeof prop == 'symbol') {
                return Reflect.get(target, prop, reciver)
            }
            
            if (paths.drawable.includes(prop)) {
                return `libs/ui/icon/${prop}.svg`
            }
            
            return `icon/${prop}.svg`
        },
        
        ownKeys(target) {
            return paths.icon
        }
    }),
    
    layout: new Proxy({}, {
        get(target, prop, reciver) {
            if (typeof prop == 'symbol') {
                return Reflect.get(target, prop, reciver)
            }
            
            return document.getElementById(prop)
        }
    })
}

export class ActionBar extends HTMLElement {
    #navicon
    
    constructor() {
        super()
        
        this.attachShadow({ mode: 'open' })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    align-items: center;
                    font-family: inherit;
                    padding: 15px 15px;
                    font-size: 1.1rem;
                    border-bottom: 1px solid lightgrey;
                    gap: 10px;
                    background: inherit;
                    color: inherit;
                }
                
                .title {
                    flex: 1;
                }
                
                .icons {
                    display: flex;
                    gap: 10px;
                }
            </style>
            
            <span class="title"></span>
            <span class="icons"></span>
        `
    }
    
    static get observedAttributes() {
        return ['title']
    }
    
    attributeChangedCallback(name, _old, value) {
        if (name === 'title') {
            this.shadowRoot.querySelector('.title').innerText = value
            return
        }
    }
    
    connectedCallback() {
        this.title = document.title || 'Title'
    }
    
    set navigationIconSrc(src) {
        if (!this.#navicon) {
            this.#navicon = new Image(24, 24)
            this.shadowRoot.querySelector(".title").before(this.#navicon)
            
            this.#navicon.onclick = () => {
                const event = new CustomEvent("navigation")
                this.dispatchEvent(event)
                // console.dir(this)
                this.onnavigation?.(event)
            }
        }
        
        this.#navicon.src = src
    }
    
    set menu(menu) {
        const icons = this.shadowRoot.querySelector('.icons')
        
        menu._items.forEach(item => {
            const icon = new Image(24, 24)
            icon.src = item.iconSrc
            icons.append(icon)
            icon.onclick = () => {
                const event = new CustomEvent('menuitemclicked', { detail: item.itemId })
                this.dispatchEvent(event)
                this.onmenuitemclicked?.(event)
            }
        })
    }
}

export class Coordinator extends HTMLElement {
    #blocker
    
    constructor() {
        super()
        
        this.style.display = 'flex'
        this.style.flexDirection = 'column'
        this.style.position = 'relative'
        this.style.height = '100dvh'
    }
    
    connectedCallback() {        
        const actionbar = this.querySelector('action-bar')
        
        let index = 1
        
        if (this.children[index].localName == 'tab-bar') {
            index++
        }
        
        if (this.children[index]) this.children[index].style.flex = 1
        
        const drawer = this.querySelector('nav-drawer')
        
        if (drawer) {
            const rect = actionbar.getBoundingClientRect()
            const blocker = this.#blocker = document.createElement('div')
        
            actionbar.navigationIconSrc = R.drawable.ic_menu
            drawer.before(blocker)
            
            drawer.style.height = `calc(100% - ${rect.height + 3.5}px)`
            drawer.style.top = `${rect.height + 3.5}px`
            drawer.style.left = 'calc(-80% - 1px)'
            
            blocker.style.position = 'absolute'
            blocker.style.width = '100%'
            blocker.style.height = `calc(100% - ${rect.height + 3.5}px)`
            blocker.style.background = 'black'
            blocker.style.top = `${rect.height + 3.5}px`
            blocker.style.transition = 'opacity .25s'
            blocker.style.opacity = '0'
            blocker.style.pointerEvents = 'none'
            
            actionbar.onnavigation = () => {
                if (drawer.style.left == '0px') {
                    drawer.style.left = 'calc(-80% - 1px)'
                    this.#hideBlocker()
                    actionbar.navigationIconSrc = R.drawable.ic_menu
                } else {
                    drawer.style.left = '0'
                    this.#showBlocker()
                    actionbar.navigationIconSrc = R.drawable.ic_close
                }
            }
            
            blocker.onclick = ev => {
                ev.preventDefault()
                
                drawer.style.left = 'calc(-80% - 1px)'
                this.#hideBlocker()
                actionbar.navigationIconSrc = R.drawable.ic_menu
                
                this.#blocker.onhide?.()
            }
        }
    }
    
    #showBlocker() {
        this.#blocker.style.opacity = '.6'
        this.#blocker.style.pointerEvents = 'auto'
                    
    }
    
    #hideBlocker() {
        this.#blocker.style.opacity = '0'
        this.#blocker.style.pointerEvents = 'none'
    }
    
    _bottomSheet(sheet) {
        this.#showBlocker()
        
        this.#blocker.onhide = () => sheet.close()
        sheet.onclose = () => this.#hideBlocker()
    }
}

export class Drawer extends HTMLElement {
    constructor() {
        super()
        
        this.style.display = "block"
        this.style.position = "absolute"
        this.style.width = "80%"
        this.style.transition = "left .24s"
        this.style.borderRightWidth = "1px"
        this.style.borderRightStyle = 'solid'
        // this.style.zIndex = '10'
    }
}

export class FileTree extends HTMLElement {
    #dir
    
    constructor() {
        super()
        
        this.attachShadow({ mode: 'open' })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    background: inherit;
                    color: inherit;
                    width: 100%;
                    height: 100%;
                }
                
                .dir {
                    display: flex;
                    align-items: center;
                    padding: 5px 10px;
                    gap: 10px;
                }
            </style>
            
            <div id="wrapper"></div>
        `
        
        this.wrapper = this.shadowRoot.getElementById('wrapper')
    }
    
    setFolder(dir, context) {
        const rootDir = document.createElement('div')
        const icon = new Image(24, 24)
        const title = document.createElement('span')
        
        this.wrapper.innerHTML = ''
        rootDir.classList.add('dir')
        icon.src = R.drawable.ic_folder
        title.innerText = dir.name
        
        rootDir.append(icon, title)
        this.wrapper.append(rootDir)
        
        rootDir.oncontextmenu = ev => {
            ev.preventDefault()
            
            const sheet = new BottomSheet()
            const menu = new Menu()
            
            menu.addItem('new-file', 'Create File')
            sheet.menu = menu
            
            sheet.onmenuitemclicked = ev => {
                switch(ev.detail) {
                    case 'new-file': {
                        dir.create(prompt('Enter File Name:'))
                        this.setFolder(dir, context)
                        break
                    }
                }
            }
            
            sheet.open(context.content)
        }
        
        let layout;
        
        rootDir.onclick = () => {
            if (icon.src.endsWith(R.drawable.ic_folder)) {
                icon.src = R.drawable.ic_folder_open
                layout = this.#listFolder(rootDir, dir, 1)
            } else {
                icon.src = R.drawable.ic_folder
                layout.remove()
            }
        }
    }
    
    #listFolder(dirItem, dir, tab) {
        const root = document.createElement('div')
        
        dir.list.forEach(name => {
            const layout = document.createElement('div')
            const icon = new Image(24, 24)
            const title = document.createElement('span')
            
            layout.classList.add('dir')
            layout.style.marginLeft = `${24 * tab}px`
            icon.src = R.drawable.ic_file
            title.innerText = name
            
            
            layout.append(icon, title)
            root.append(layout)
            
            layout.onclick = () => {
                const event = new CustomEvent('itemclick', { detail: `${name}` })
                this.onitemclick?.(event)
            }
        })
        
        dirItem.after(root)
        return root
    }
}

export class BottomSheet extends HTMLElement {
    constructor() {
        super()
        
        this.attachShadow({ mode: "open" })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --border-radius: 30px;
                    
                    display: block;
                    background: white;
                    color: inherit;
                    position: absoulte;
                    bottom: 0;
                    box-shadow: 0 0 5px 0px lightgrey;
                    border-top-left-radius: var(--border-radius);
                    border-top-right-radius: var(--border-radius);
                    padding: 30px;
                    z-index: 1;
                }
                
                .item {
                    display: flex;
                    padding: 10px 0;   
                }
            </style>
        `
    }
    
    set menu(menu) {
        menu._items.forEach(item => {
            const layout = document.createElement('div')
            const icon = new Image(24, 24)
            const title = document.createElement('span')
            
            layout.classList.add('item')
            icon.src = item.iconSrc
            title.innerText = item.title
            
            if (item.iconSrc) layout.append(icon, title)
            else layout.append(title)
            
            this.shadowRoot.append(layout)
            
            layout.onclick = () => {
                const event = new CustomEvent('menuitemclicked', { detail: item.itemId })
                this.dispatchEvent(event)
                this.onmenuitemclicked?.(event)
                
                this.close()
            }
        })
    }
    
    open(coordinator) {
        coordinator.append(this)
        coordinator._bottomSheet(this)
    }
    
    close() {
        this.remove()
        this.onclose?.()
    }
}

class Folder {
    get name() {
        return null
    }
    
    get list() {
        return (localStorage.getItem("/") || '').split('\n')
    }
}

FileTree.Folder = Folder

export class Menu {
    _items = []
    
    addItem(itemId, title, iconSrc) {
        this._items.push({ itemId, title, iconSrc })
    }
}

export class Activity {
    #content
    
    onCreate() {}
    
    onCreateOptionMenu(menu) {}
    
    static start(activityConstructor) {
        const activity = new activityConstructor()
        activity.onCreate()
        
        const menu = new Menu()
        activity.onCreateOptionMenu(menu)
        activity.actionBar.menu = menu
    }
    
    set content(content) {
        if (content instanceof HTMLElement) {
            content.display = 'flex'
            this.#content = content
        }
        
        this.actionBar = this.querySelector('action-bar')
    }
    
    get content() {
        return this.#content
    }
    
    querySelector(id) {
        return this.#content.querySelector(id)
    }
}

class TabBar extends HTMLElement {
    #tabs = new Map()
    #ids = 0
    
    constructor() {
        super()
        
        this.attachShadow({ mode: 'open' })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    border-bottom: 1px solid;
                }
                
                .tab, div {
                    padding: 15px;
                    border-right: 1px solid;
                    border-color: inherit;
                    width: fit-content;
                }
            </style>
        `
    }
    
    addTab(name) {
        const tab = document.createElement('div')
        // const title = document.createElement('span')
        
        tab.innerText = name
        
        tab.classList.add('tab')
        
        this.shadowRoot.append(tab)
    }
}

class Editor extends HTMLElement {
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
                
                .tok-func-call {
                    color: #DCDCAA;
                }
                
                .tok-bracket-depth-0 {
                    color: #FFD700; /* Gold */
                }

                .tok-bracket-depth-1 {
                    color: #ADFF2F; /* GreenYellow */
                }

                .tok-bracket-depth-2 {
                    color: #87CEFA; /* LightSkyBlue */
                }

                .tok-bracket-depth-3 {
                    color: #FF69B4; /* HotPink */
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
                }
                
                .tok-err {
                    display: inline-block;
                    text-decoration: underline;
                    text-decoration-style: wavy;
                    text-decoration-color: red;
                }
                
                .error-tooltip {
                    position: absolute;
                    background: var(--tooltip-background);
                    height: fit-content;
                    border: 1px solid red;
                    padding: 10px;
                    margin: 10px;
                    display: none;
                }
            </style>
            
            <div class="wrapper">
                <div class="lineno"></div>
                
                <div class="editor">
                    <textarea></textarea>
                    <pre></pre>
                </div>
                
                <div class="error-tooltip"></div>
            </div>
        `
        
        this.#lineno = this.shadowRoot.querySelector('.lineno')
        this.#textarea = this.shadowRoot.querySelector('textarea')
        this.#pre = this.shadowRoot.querySelector('pre')
        this.#errTooltip = this.shadowRoot.querySelector('.error-tooltip')
    }
    
    connectedCallback() {
        this.#lineno.innerText = '1'
        
        this.#textarea.oninput = ev => {
            this.#lastInputEvent = ev
        }
        
        this.#textarea.onkeyup = this.#update.bind(this)
        this.#textarea.onclick = this.#update.bind(this)
    }
    
    get value() {
        return this.#textarea.value
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
        
        this.#textarea.value = left + text + right
        this.#update()
    }
    
    set server(server) {
        this.#server = server
        
        server.match = (start, end) => {
            this.addEventListener('updated', () => {
                if (this.#lastInputEvent.inputType != 'insertText' || this.#lastInputEvent.data != start) return
                
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
    
    #update() {
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


customElements.define("action-bar", ActionBar)
customElements.define("coordinator-layout", Coordinator)
customElements.define("nav-drawer", Drawer)
customElements.define("file-tree", FileTree)
customElements.define("bottom-sheet", BottomSheet)
customElements.define("tab-bar", TabBar)
customElements.define("code-editor", Editor)

// cubic-bezier(0.68, -0.55, 0.27, 1.55)