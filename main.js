import { Activity, R, Mutable } from "ui/core.js";
import "ui/editor/editor.js"

import Interpreter from "sour-lang/interpreter/interpreter.js";
import Server from "sour-lang/server.js"


class MainActivity extends Activity {
    tabs = []
    
    dir = new File('/')
    
    onCreate() {
        this.content = R.layout.main
        
        this.actionBar.onmenuitemclicked = ev => {
            switch(ev.detail) {
                case 'save': return this.saveActiveFile()
                case 'run': return this.runActiveFile()
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
                // this.editor.disable()
                this.editor.disableLineNo()
                this.editor.server = null
                this.editor.value = tab.content
                this.editor.outputStream = tab.outputStream
                console.dir(this.editor)
                console.log(tab.outputStream)
            } else {
                this.editor.enable()
                this.editor.enableLineNo()
                this.editor.server = new Server(this.dir.child(tab.path))
                this.editor.value = tab.content
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
        this.editor.disableLineNo()
        
        const savefile = new File('.sourcode')
        
        if (savefile.exists()) {
            const data = JSON.parse(savefile.read())
            
            if (data.active_file) {
                this.openFile(data.active_file)
            }
        }
    }
    
    onCreateOptionMenu(menu) {
        menu.addItem("save", "Save", "icon/save.svg");
        menu.addItem("run", "Run", "icon/play-arrow.svg");
    }
    
    openFile(path) {
        if (this.tabs.some(tab => tab.path === path)) return
        
        const content = new Mutable(new File(path).read())
        
        this.tabs.push({
            type: 'file',
            path, content
        })
        
        content.subscribe(data => new File(path).write(data))
        
        this.tabbar.addTab(path)
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

class File {
    
    #path
    
    constructor(path) {
        this.#path = path
    }
    
    exists() {
        return this.name in JSON.parse(localStorage.getItem(this.parent.path))
    }
    
    create() {
        try {
            const data = JSON.parse(localStorage.getItem(this.parent.path))
            data[this.name] = 'file'
            localStorage.setItem(this.path, '')
            localStorage.setItem(this.parent.path, JSON.stringify(data))
            
            return true
        } catch {
            return false
        }
    }
    
    read() {
        return localStorage.getItem(this.path)
    }
    
    write(data) {
        localStorage.setItem(this.path, data)
    }
    
    child(path) {
        return new File(this.path + '/' + path)
    }
    
    get list() {
        return Object.keys(JSON.parse(localStorage.getItem(this.parent.path)))
    }
    
    get name() {
        return this.#path.split('/')
            .filter(Boolean)
            .at(-1) || '/'
    }

    get base() {
        return this.name.split('.').slice(0, -1).join('.')
    }
    
    get path() {
        return '/' + this.#path.split('/')
            .filter(Boolean)
            .join('/')
    }
    
    get parent() {
        return new File('/' + this.#path.split('/')
            .filter(Boolean)
            .slice(0, -1)
            .join('/'))
    }
}

if (!localStorage.getItem('/')) {
    localStorage.setItem('/', '{}')
}

Activity.start(MainActivity)