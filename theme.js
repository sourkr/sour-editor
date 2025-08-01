export default class Theme {
    #themes = new Map()
    
    register(name, colors) {
        this.#themes.set(name, colors)
    }
}