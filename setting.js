import { Activity, R, Row } from "./libs/ui/core.js";
import Theme from "./theme.js"
import File from "./file.js"

export default class SettingsActivity extends Activity {
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

    add_setting(name, data) {
        const layout = new Row()
        const title = document.createElement('span')

        if (data.type !== 'group') {
            const right = this.create_right(data, value => {
                if (data.onchange.type === 'js') {
                    eval(data.onchange.script)
                }   
                
                const file = new File('.settings')

                if (!file.exists()) {
                    file.create()
                    file.write('{}')
                }

                const settings = JSON.parse(file.read())
                settings[name] = value
                file.write(JSON.stringify(settings))
            })

            layout.append(title, right)
        }

        title.innerText = data.title

        this.content.append(layout)
    }

    create_right(data, callback) {
        if (data.type === 'picker') {
            const select = document.createElement('select')

            if (data.values.type === 'js') {
                eval(data.values.script).forEach((option, i) => {
                    select.append(new Option(option, option));
                })
            }

            select.onchange = ev => callback(select.value)

            return select
        }
    }
}
