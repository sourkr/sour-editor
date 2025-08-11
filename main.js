import { Activity, R, Mutable, Intent } from "ui/core.js";
import Editor from "./libs/ui/editor/editor.js";

import Server from "./libs/sourlang/server.js";
import Interpreter from "./libs/sourlang/interpreter/interpreter.js";

import DEF_APP from "./sour-lang/app.js";
import Extension from "./extension.js";
import File from "./file.js";
import SettingsActivity from "./setting.js";
import Theme from "./theme.js";

class MainActivity extends Activity {
    tabs = [];
    dir = new File("/");

    /** @override */
    async onCreate() {
        super.onCreate();

        await this.loadExtensions();
        this.loadSettings();

        this.content = R.layout.main;

        this.filetree = this.querySelector("file-tree");
        this.tabbar   = this.querySelector("tab-bar");
        this.main     = this.querySelector("#main");

        this.actionBar.onmenuitemclicked = this.handleMenuAction;
        this.filetree.setFolder(this.dir, this);
        this.filetree.onitemclick = (ev) => this.openFile(ev.detail);
        this.tabbar.ontabselected = ({ detail }) => this.switchTab(detail);

        this.restoreLastFile();
    }

    /** @override */
    onCreateOptionMenu(menu) {
        menu.addItem("save", "Save", "icon/save.svg");
        menu.addItem("run", "Run", "icon/play-arrow.svg");
        menu.addItem("settings", "Settings", "icon/settings.svg");
    }

    handleMenuAction = ({ detail }) => {
        if (detail === "save") return this.saveActiveFile();
        if (detail === "run") return this.runActiveFile();
        if (detail === "settings") return this.openSettings();
    };

    loadSettings() {
        const file = new File(".settings");
        if (file.exists()) {
            const settings = JSON.parse(file.read());
            if (settings.theme) Theme.set(settings.theme);
        }
    }

    async loadExtensions() {
        try {
            await Extension.init();
            await Extension.load_all();
        } catch (err) {
            console.error(err);
        }
    }

    restoreLastFile() {
        const savefile = new File(".sourcode");
        if (savefile.exists()) {
            const data = JSON.parse(savefile.read());
            if (data.active_file) this.openFile(new File(data.active_file));
        }
    }

    openSettings() {
        const intent = new Intent(this, SettingsActivity);
        intent.extras.set("name", "main");
        intent.extras.set("editor", this.editor);
        this.startActivity(intent);
    }

    openFile(file) {
        if (this.tabs.some((tab) => tab.path === file.path)) return;

        const content = new Mutable(file.read());
        const element = new Editor();
        const server = new Server(file);

        server.add_module("app", Extension.def);

        element.classList.add("hidden");
        element.server = server;
        element.text = content;

        content.subscribe((data) => file.write(data));

        this.tabs.push({ type: "file", path: file.path, content, element });
        this.main.append(element);
        this.tabbar.addTab(file.name);
    }

    saveActiveFile() {
        if (!this.active_file) {
            alert("No active file selected to save.");
            return;
        }
        const file = this.dir.child(this.active_file);
        const tab = this.tabs.find((t) => t.path === file.path);
        if (tab) file.write(tab.content.value);
    }

    switchTab(index) {
        const tab = this.tabs[index];
        if (!tab) return;

        this.active_tab?.element.classList.add("hidden");
        this.active_tab = tab;
        tab.element.classList.remove("hidden");

        if (tab.type !== "output") {
            const savefile = new File(".sourcode");
            const data = savefile.exists() ? JSON.parse(savefile.read()) : {};
            data.active_file = this.active_file = tab.path;
            savefile.write(JSON.stringify(data));
        }
    }

    runActiveFile() {
        if (!this.active_file) {
            alert("No file selected to run.");
            return;
        }

        const file = this.dir.child(this.active_file);
        const interpreter = new Interpreter(file);
        interpreter.add_module("app", this.def, DEF_APP);

        let outputTab = this.tabs.find((t) => t.type === "output");
        if (!outputTab) {
            const content = new Mutable("");
            const element = new Editor();

            element.classList.add("hidden");
            element.text = content;
            element.disableFeature(Editor.FEATURE.HTML);
            element.disableFeature(Editor.FEATURE.LINE_NUMBER);

            outputTab = {
                type: "output",
                outputStream: interpreter.outputStream,
                content,
                element
            };

            this.tabs.push(outputTab);
            this.main.append(element);
            this.tabbar.addTab("Output");
        }

        outputTab.outputStream = interpreter.outputStream;
        interpreter.interprete();
        outputTab.content.value = "";

        (async () => {
            while(true) {
                const chunk = await interpreter.inputStream.read()
                console.log(chunk);
                outputTab.content.value += chunk;
            }
        })();

        (async () => {
            while(true) {
                const chunk = await interpreter.errorStream.read()
                outputTab.content.value += chunk;
            }
        })();
    }
}

Activity.start(MainActivity);
