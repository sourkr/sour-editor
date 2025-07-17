import { Menu, FileTree, Activity, R } from "ui/core.js";
import "ui/editor.js"

import Interpreter from "./libs/sourlang/interpreter.js";
import Server from "./libs/sourlang/server.js"


// const codeEditor = document.getElementById('code-editor');
// const highlightingArea = document.getElementById('highlighting-area');
// const highlightingLayer = document.getElementById('highlighting-layer');
const tabBar = document.getElementById('tab-bar');
// const tabContent = document.getElementById('tab-content');

let activeFileName = null;
let activeTabs = [];

class MainActivity extends Activity {
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
        this.filetree.setFolder(new LocalStorageRoot(), this)
        
        this.filetree.onitemclick = ev => {
            const path = ev.detail
            // const content = localStorage.getItem(`/${path}`) || ''
            
            this.tabbar.addTab(path)
        }
        
        
        // Initilize Editor
        this.editor.server = new Server()
    }
    
    onCreateOptionMenu(menu) {
        menu.addItem("save", "Save", "icon/save.svg");
        menu.addItem("run", "Run", "icon/play-arrow.svg");
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
        const interpreter = new Interpreter(codeEditor.value, "internal.sour");
        const outputFileName = "Output";
        let outputContent = "";
        
        // this.tabbar.addTab(outputFileName, outputContent);
            
        interpreter.interprete();
        
        const updateOutput = (chunk) => {
            const tabIndex = activeTabs.findIndex(tab => tab.fileName === outputFileName);
            if (tabIndex !== -1) {
                activeTabs[tabIndex].content += chunk;
                if (activeFileName === outputFileName) {
                    codeEditor.value = activeTabs[tabIndex].content;
                }
            }
        };
        
        (async () => {
            while (true) {
                const chunk = await interpreter.inputStream.read();
                updateOutput(chunk);
            }
        })();
        
        (async () => {
            while (true) {
                const chunk = await interpreter.errorStream.read();
                updateOutput(chunk);
            }
        })();
    }
}

class LocalStorageRoot extends FileTree.Folder {
    get name() {
        return '/'
    }
    
    get list() {
        const list = localStorage.getItem('/')
        return list ? list.split('\n') : []
    }
    
    create(name) {
        localStorage.setItem('/', [...this.list, name].join('\n'))
    }
}

Activity.start(MainActivity)