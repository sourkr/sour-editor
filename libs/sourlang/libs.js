import paths from "./libs/paths.json" with { type: "json" }
import File from "../../file.js"

// const LIBS = new Map()
const dir = new File('libs')

if (!dir.exists()) {
    dir.mkdir()
}

for (let path of paths) {
    const code = await (await fetch(`./libs/sourlang/libs/${path}.sour`)).text()
    const file = dir.child(`${path}.sour`)

    file.create()
    file.write(code)
}
