import { Activity, R, Mutable, Intent } from "ui/core.js";
import Editor from "ui/editor/editor.js"

import Interpreter from "sour-lang/interpreter/interpreter.js";
import Server from "sour-lang/server.js"

import DEF_APP from "./sour-lang/app.js";
import Extension from "./extension.js";
import File from "./file.js"
import SettingsActivity from "./setting.js";
import Theme from "./theme.js";

class MainActivity extends Activity {
    tabs = []
    
    dir = new File('/')

    /** @override */
    async onCreate() {
        super.onCreate()

        this.def = await this.load_def()
        this.load_setting()

        this.content = R.layout.main
        
        this.actionBar.onmenuitemclicked = ev => {
            switch(ev.detail) {
                case 'save': return this.saveActiveFile()
                case 'run': return this.runActiveFile()
                case 'settings': return this.openSettings()
            }
        }
        
        this.filetree = this.querySelector('file-tree')
        this.tabbar = this.querySelector('tab-bar')
        this.editor = this.querySelector('code-editor')
        
        // Initilize File Tree
        this.filetree.setFolder(this.dir, this)
        
        this.filetree.onitemclick = ev => this.openFile(ev.detail)
        
        // Initilize Tab Bar
        this.tabbar.ontabselected = ({ detail: index }) => {
            const tab = this.tabs[index]
            
            if (tab?.type == 'output') {
                this.editor.disableFeature(Editor.FEATURE.LINE_NUMBER)
                this.editor.server = null
                this.editor.text = tab.content
                this.editor.outputStream = tab.outputStream
            } else {
                const server = new Server(this.dir.child(tab.path))
                server.add_module('app', Extension.def)
                
                this.editor.enable()
                this.editor.enableFeature(Editor.FEATURE.LINE_NUMBER)
                this.editor.server = server
                this.editor.text = tab.content
                this.editor.outputStream = null
                
                const savefile = new File('.sourcode')
                
                if (!savefile.exists()) {
                    savefile.create()
                    savefile.write('{}')
                }
                
                const data = JSON.parse(savefile.read())
                data.active_file = this.active_file = tab.path
                savefile.write(JSON.stringify(data))
            }
        }
        
        
        // Initilize Editor
        this.editor.server = null
        this.editor.disable()
        this.editor.disableFeature(Editor.FEATURE.LINE_NUMBER)
       
        const savefile = new File('.sourcode')
        // console.log({ savefile })
        
        if (savefile.exists()) {
            const data = JSON.parse(savefile.read())
            
            if (data.active_file) {
                this.openFile(new File(data.active_file))
            }
        }
    }

    /** @override */
    onCreateOptionMenu(menu) {
        menu.addItem("save", "Save", "icon/save.svg");
        menu.addItem("run", "Run", "icon/play-arrow.svg");
        menu.addItem("settings", "Settings", "icon/settings.svg");
    }

    load_setting() {
        const file = new File('.settings')

        if (!file.exists()) return

        const settings = JSON.parse(file.read())

        if (settings.theme) {
            Theme.set(settings.theme)
        }
    }

    openSettings() {
        const intent = new Intent(this, SettingsActivity)
        
        intent.extras.set("name", "main")
        intent.extras.set("editor", this.editor)
        
        this.startActivity(intent)
    }

    async load_def() {
        try {
            await Extension.init()
            await Extension.load_all()
        } catch (err) {
            console.error(err)
        }
    }
    
    openFile(file) {
        if (this.tabs.some(tab => tab.path === file.path)) return
        
        const content = new Mutable(file.read())
        
        this.tabs.push({
            type: 'file',
            path: file.path, content
        })
        
        content.subscribe(data => file.write(data))
        
        this.tabbar.addTab(file.name)
    }
    
    
    saveActiveFile() {
        const fileName = activeFileName
        
        if (!fileName) {
            alert("No active file selected to save. Please open a file or create a new one via the context menu.");
            return
        }
        
        saveActiveFile(fileName, codeEditor.value)
    }
    
    runActiveFile() {
        const file = this.dir.child(this.active_file)
        const interpreter = new Interpreter(file);
        interpreter.add_module('app', this.def, DEF_APP)
        
        if (!this.tabs.some(tab => tab.type == 'output')) {
            this.tabs.push({
                type: 'output',
                outputStream: interpreter.outputStream,
                content: new Mutable('')
            })
            
            this.tabbar.addTab('Output')
        }
        
        const tab = this.tabs.find(tab => tab.type == 'output')
        
        tab.outputStream = interpreter.outputStream
            
        interpreter.interprete()
        
        ;(async () => {
            while (true) {
                const chunk = await interpreter.inputStream.read();
                tab.content.value += chunk
            }
        })()
        
        ;(async () => {
            while (true) {
                const chunk = await interpreter.errorStream.read();
                tab.content.value += chunk
            }
        })();
    }
}

Activity.start(MainActivity)

// navigator.virtualKeyboard.overlaysContent = true;

// navigator.virtualKeyboard.addEventListener("geometrychange", (event) => {
//     const { x, y, width, height } = event.target.boundingRect;

//     document.body.style.height = `calc(100dvh - ${height}px)`
// });
