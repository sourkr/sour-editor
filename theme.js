export default class Theme {
    static #themes = new Map()
    static #active_theme
    
    static register(name, colors) {
        const theme = { name, colors }
        this.#themes.set(name, theme)

        if (!this.#active_theme){
            this.#active_theme = theme
            this.set(name)
        }
    }

    static get(name) {
        return this.#themes.get(name)
    }

    static list() {
        return this.#themes.keys()
    }

    static set(name) {
        const colors = this.#themes.get(name).colors

        colors.forEach((color, name) => {
            document.body.style.setProperty(`--${name}`, color)
        })
    }
}
