const paths = await (await fetch('./libs/ui/paths.json')).json()

const R = {
    icon: new Proxy({}, {
        get(target, prop, reciver) {
            if (typeof prop == 'symbol') {
                return Reflect.get(target, prop, reciver)
            }
            
            if (paths.icon.includes(prop)) {
                return `libs/ui/icon/${prop}.svg`
            }
            
            return `icon/${prop}.svg`
        },
        
        ownKeys(target) {
            return paths.icon
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
        
        if (this.children[1]) this.children[1].style.flex = 1
        
        const drawer = this.querySelector('nav-drawer')
        
        if (drawer) {
            const rect = actionbar.getBoundingClientRect()
            const blocker = this.#blocker = document.createElement('div')
        
            actionbar.navigationIconSrc = R.icon.ic_menu
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
                    actionbar.navigationIconSrc = R.icon.ic_menu
                } else {
                    drawer.style.left = '0'
                    this.#showBlocker()
                    actionbar.navigationIconSrc = R.icon.ic_close
                }
            }
            
            blocker.onclick = ev => {
                ev.preventDefault()
                
                drawer.style.left = 'calc(-80% - 1px)'
                this.#hideBlocker()
                actionbar.navigationIconSrc = MENU_ICON_URL
                
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
        `
    }
    
    setFolder(dir, root) {
        const rootDir = document.createElement('div')
        const icon = new Image(24, 24)
        const title = document.createElement('span')
        
        
        rootDir.classList.add('dir')
        icon.src = FOLDER_ICON_URL
        title.innerText = dir.name
        
        rootDir.append(icon, title)
        this.shadowRoot.append(rootDir)
        
        rootDir.oncontextmenu = ev => {
            ev.preventDefault()
            
            const sheet = new BottomSheet()
            const menu = new Menu()
            
            menu.addItem('new-file', 'Create File')
            sheet.menu = menu
            
            sheet.onmenuitemclicked = ev => {
                switch(ev.detail) {
                    case 'new-file': {
                        dir.create(name)
                        this.setFolder(dir, root)
                        break
                    }
                }
            }
            
            sheet.open(root)
        }
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

customElements.define("action-bar", ActionBar)
customElements.define("coordinator-layout", Coordinator)
customElements.define("nav-drawer", Drawer)
customElements.define("file-tree", FileTree)
customElements.define("bottom-sheet", BottomSheet)
// scustomElements.define("holdable-element", HoldableElement)

// cubic-bezier(0.68, -0.55, 0.27, 1.55)