const TYPE_CODES = {
    func: "\uea8c",
    kw: "\ueb62",
    type: "\ueb62",
    var: "\uea88",
    class: "\ueb5b",
    file: "\uea8b"
}

class AutoCompletionManager {
    isVisible = false;

    constructor(editor, completion) {
        this.editor = editor;
        this.completion = completion
    }

    init(doc) {
        this.doc = doc;

        window.addEventListener("keydown", (ev) => {
            if (!this.isVisible) return;

            if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();

                this.complete(this.itemList[this.selected]);
                return;
            }

            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                ev.stopPropagation();

                this.selected = Math.max(0,
                    Math.min(this.itemList.length - 1, this.selected + 1))

                this.itemList.forEach((item, i) => {
                    if (i === this.selected) {
                        item.layout.style.background = "var(--autocompletion-selected-background)";
                        this.doc.showAnchor(item.doc, this.completion);
                    } else {
                        item.layout.style.background = "transparent";
                    }
                });

                return;
            }

            if (ev.key === "ArrowUp") {
                ev.preventDefault();
                ev.stopPropagation();

                this.selected = Math.max(0,
                    Math.min(this.itemList.length - 1, this.selected - 1))

                this.itemList.forEach((item, i) => {
                    if (i === this.selected) {
                        item.layout.style.background = "var(--autocompletion-selected-background)";
                        this.doc.showAnchor(item.doc, this.completion);
                    } else {
                        item.layout.style.background = "transparent";
                    }
                });

                return;
            }

            this.hide();
        });
    }

    show(itemList) {
        this.isVisible = true;
        this.itemList = itemList;
        this.selected = 0;

        if (!itemList?.length) {
            this.hide();
            return;
        }

        this.completion.innerHTML = "";
        this.completion.style.display = "flex";

        this.completion.style.top = `calc(${this.editor.cursor.y}px + 1.5em)`;
        this.completion.style.left = `calc(${this.editor.cursor.x}px - 1em)`;

        itemList.forEach((item, i) => {
            const layout = (item.layout = document.createElement("div"));
            const text = `${TYPE_CODES[item.type]} <span class="prefix">${item.prefix}</span>${item.name.slice(item.prefix.length)}`;

            layout.innerHTML = text;
            this.completion.append(layout);

            if (i == 0) {
                layout.style.background = "var(--autocompletion-selected-background)";
                this.doc.showAnchor(item.doc, this.completion);
            }

            layout.onclick = () => this.complete(item);
        });
    }

    complete(item) {
        if (item.type == "func") {
            this.editor.insertAtCursor(`${item.name.slice(item.prefix.length)}()`);
            if (item.doc.params.length) this.editor.cursorIndex--;
        } else if (item.type == "kw") {
            this.editor.insertAtCursor(`${item.name.slice(item.prefix.length)} `);
        } else {
            this.editor.insertAtCursor(item.name.slice(item.prefix.length));
        }

        this.hide();
    }

    hide() {
        this.isVisible = false;
        this.completion.style.display = "none";
        // this.doc.hide();
    }

    get rect() {
        return this.completion.getBoundingClientRect();
    }
}
