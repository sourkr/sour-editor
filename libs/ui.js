const MENU_ICON_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjRjNGM0YzIj48cGF0aCBkPSJNMTYwLTI0MHEtMTcgMC0yOC41LTExLjVUMTIwLTI4MHEwLTE3IDExLjUtMjguNVQxNjAtMzIwaDY0MHExNyAwIDI4LjUgMTEuNVQ4NDAtMjgwcTAgMTctMTEuNSAyOC41VDgwMC0yNDBIMTYwWm0wLTIwMHEtMTcgMC0yOC41LTExLjVUMTIwLTQ4MHEwLTE3IDExLjUtMjguNVQxNjAtNTIwaDY0MHExNyAwIDI4LjUgMTEuNVQ4NDAtNDgwcTAgMTctMTEuNSAyOC41VDgwMC00NDBIMTYwWm0wLTIwMHEtMTcgMC0yOC41LTExLjVUMTIwLTY4MHEwLTE3IDExLjUtMjguNVQxNjAtNzIwaDY0MHExNyAwIDI4LjUgMTEuNVQ4NDAtNjgwcTAgMTctMTEuNSAyOC41VDgwMC02NDBIMTYwWiIvPjwvc3ZnPg=="
const CLOSE_ICON_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjRjNGM0YzIj48cGF0aCBkPSJNNDgwLTQyNCAyODQtMjI4cS0xMSAxMS0yOCAxMXQtMjgtMTFxLTExLTExLTExLTI4dDExLTI4bDE5Ni0xOTYtMTk2LTE5NnEtMTEtMTEtMTEtMjh0MTEtMjhxMTEtMTEgMjgtMTF0MjggMTFsMTk2IDE5NiAxOTYtMTk2cTExLTExIDI4LTExdDI4IDExcTExIDExIDExIDI4dC0xMSAyOEw1MzYtNDgwbDE5NiAxOTZxMTEgMTEgMTEgMjh0LTExIDI4cS0xMSAxMS0yOCAxMXQtMjgtMTFMNDgwLTQyNFoiLz48L3N2Zz4="

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
                    border-bottom: .5px solid lightgrey;
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
            const blocker = document.createElement('div')
        
            actionbar.navigationIconSrc = MENU_ICON_URL
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
                    blocker.style.opacity = '0'
                    blocker.style.pointerEvents = 'none'
                    actionbar.navigationIconSrc = MENU_ICON_URL
                } else {
                    drawer.style.left = '0'
                    blocker.style.opacity = '.6'
                    blocker.style.pointerEvents = 'auto'
                    actionbar.navigationIconSrc = CLOSE_ICON_URL
                }
            }
            
            blocker.onclick = ev => {
                ev.preventDefault()
                
                drawer.style.left = 'calc(-80% - 1px)'
                blocker.style.opacity = '0'
                blocker.style.pointerEvents = 'none'
                actionbar.navigationIconSrc = MENU_ICON_URL
            }
        }
    }
}

export class Drawer extends HTMLElement {
    constructor() {
        super()
        
        this.style.display = "block"
        this.style.position = "absolute"
        this.style.width = "80%"
        this.style.transition = "left .24s"
        // this.style.background = ""
        this.style.borderRightWidth = "1px"
        this.style.borderRightStyle = "solid"
    }
}

export class Menu {
    _items = []
    
    addItem(itemId, iconSrc) {
        this._items.push({ itemId, iconSrc })
    }
}

customElements.define("action-bar", ActionBar)
customElements.define("coordinator-layout", Coordinator)
customElements.define("nav-drawer", Drawer)

// cubic-bezier(0.68, -0.55, 0.27, 1.55)