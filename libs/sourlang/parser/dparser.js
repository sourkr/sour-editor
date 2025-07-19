import { BaseParser } from "./base.js";

const TYPES = new Set(["char", "byte", "bool", "string"]);

export default class DefinationParser extends BaseParser {
    file() {
        if (this.is("kw", "var")) {
            const kw = this.next();
            const doc = this.lastComment;
            const name = this.next("ident");
            this.skip("punc", ":");
            const type = this.type();

            return { type: "var-def", kw, doc, name, type };
        }

        if (this.is("kw", "func")) {
            const kw = this.next();
            const doc = this.lastComment;
            this.lastComment = null;
            const name = this.next("ident");
            const params = this.list("(,)", this.param);
            const colon = this.next("punc", ":");
            const retType = this.type();

            return { type: "func-def", kw, doc, name, params, colon, retType };
        }

        if (this.is("kw", "class")) {
            const kw = this.next();
            const doc = this.lastComment;
            this.lastComment = null;
            const name = this.next("ident");
            const body = this.list("{}", this.file);

            return {
                type: "class-def",
                kw,
                doc,
                name,
                body,
                is_type: TYPES.has(name.value),
            };
        }

        return super.file();
    }

    param() {
        const name = this.next("ident");
        const colon = this.next("punc", ":");
        const type = this.type();

        return { name, colon, type };
    }

    type() {
        const name = this.next("ident");
        return { type: "simple", name };
    }

    list(cond, parse, ...args) {
        if (cond.length == 3) {
            const list = [];
            const sep = [];

            const startTok = this.next("punc", cond[0]);

            if (this.hasError()) return { startTok, list, sep };

            if (this.is("punc", cond[2])) {
                const endTok = this.next();
                return { startTok, list, sep, endTok };
            }

            while (this.has) {
                list.push(parse.call(this));

                if (this.is("punc", cond[2])) {
                    const endTok = this.next();
                    return { startTok, list, sep, endTok };
                }

                if (this.hasError()) return { startTok, list, sep };

                sep.push(this.next("punc", cond[1]));
            }
        }

        if (cond.length == 2) {
            const list = [];

            const startTok = this.next("punc", cond[0]);

            if (this.hasError()) return { startTok, list };

            while (this.has) {
                if (this.is("punc", cond[2])) {
                    const endTok = this.next();
                    return { startTok, list, endTok };
                }

                list.push(parse.call(this, ...args));

                if (this.hasError()) return { startTok, list };
            }
        }
    }

    toType(type) {
        if (type.type === "simple") {
            return { type: "simple", name: type.name.value };
        }
    }
}
