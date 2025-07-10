export class ActionBar extends HTMLElement {
    #navicon
    
    constructor() {
        super()
        
        this.attachShadow({ mode: 'open' })
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --color-border: inherit;
                    
                    display: flex;
                    align-items: center;
                    font-family: inherit;
                    padding: 15px 15px;
                    font-size: 1.1rem;
                    border-bottom: 1px solid var(--color-border);
                    gap: 15px;
                    background: inherit;
                    color: inherit;
                }
                
                .title {
                    flex: 1;
                }
                
                .icons {
                    display: flex;
                    gap: 20px;
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
        this.style.height = "100dvh"
    }
    
    connectedCallback() {
        // console.dir(this.children)
        if (this.children[1]) this.children[1].style.flex = 1
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