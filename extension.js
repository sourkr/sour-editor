import File from './file.js'
import Validator from "./libs/sourlang/parser/dvalidator.js"
import Interpreter from "./libs/sourlang/interpreter/interpreter.js"
import DEF_APP from './sour-lang/app.js'

import paths from './extensions/paths.json' with { type: 'json' }

export default class Extension {
    static async init() {
        const code = await (await fetch('./sour-lang/app.sour')).text()
        const validator = new Validator(code)

        validator.validate()

        if (validator.errors.lenght) {
            validator.errors.forEach(err => console.error)
            throw new Error(`Failed to load './sour-lang/app.sour'`)
        }

        this.def = validator.globals
    }

    static async #load_default_extensions() {
        for(let path of paths) {
            const code = await (await fetch(`./extensions/${path}`)).text()
            const file = new File(`/extensions/${path}`)

            if(!file.create()) {
                console.warn(`Failed to create file ${file}`)
            }
            file.write(code)
        }
    }

    static async load_all() {
        const dir = new File('/extensions/')

        if (!dir.exists()) {
            dir.mkdir()
        }

        await this.#load_default_extensions()

        for(let file of dir.files) {
            await this.load_extension(file)
        }
    }
    
    static load_extension(file) { 
        return new Promise((resolve, reject) => {
            const interpreter = new Interpreter(file)

            interpreter.add_module('app', this.def, DEF_APP)
            interpreter.interprete({ resolve, reject })
        })
    }
}
