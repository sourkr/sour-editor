import { Activity, R, Row, Text } from "./libs/ui/core.js";
import Theme from "./theme.js"
import File from "./file.js"

export default class SettingsActivity extends Activity {
    isFirst = true
    
    /** @override */
    async onCreate() {
        super.onCreate()
        
        this.content =  R.layout.settings

        this.actionBar.title = "Settings"

        const path = `./settings/${this.intent.extras.get("name", "main")}.json`
        const json = await (await fetch(path)).json()

        Object.entries(json).forEach(([key, value]) => {
            this.add_setting(key, value)
        })
    }

    onDestroy() {
        
    }

    add_setting(name, data) {
        const layout = new Row()
        const title = new Text(data.title)

        if (data.type !== 'group') {
            const selected = Settings.get(name)
            const right = this.create_right(data, selected, value => {
                if (data.onchange.type === 'js') {
                    eval(data.onchange.script)
                }   
                
                Settings.set(name, value)
            })

            layout.append(title, right)
        }

        layout.style.padding = "10px"

        if (!this.isFirst) {
            // layout.style.borderTop = `1px solid var(--border)`
        }

        title.style.cssText = `
            flex: 1;
        `

        this.isFirst = false

        this.content.append(layout)
    }

    create_right(data, selected, callback) {
        if (data.type === 'picker') {
            const select = document.createElement('select')

            let values = []
            
            if (Array.isArray(data.values)) {
                values = data.values
            }
            
            if (data.values.type === 'js') {
                values = eval(data.values.script)
            }
            
            values.forEach(option => {
                select.append(new Option(option, option, false, selected === option));
            })

            select.onchange = () => callback(select.value)

            return select
        }
    }
}

export class Settings {
    static #file = new File(".settings")
    static #settings

    static {
        if (!this.#file.exists()) {
            this.#file.create()
            this.#file.write("{}")
        }

        this.#settings = JSON.parse(this.#file.read())
    }

    static has(name) {
        return name in this.#settings
    }

    static get(name) {
        return this.#settings[name]
    }

    static set(name, value) {
        this.#settings[name] = value
        this.#file.write(JSON.stringify(this.#settings))
    }
}
