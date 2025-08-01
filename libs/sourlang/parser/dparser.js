import { BaseParser } from "./base.js";

const TYPES = new Set(["char", "byte", "bool", "string"]);

export default class DefinationParser extends BaseParser {
    file() {
        // console.log(this.peek())
        if (this.is("kw", "export")) {
            const exportTok = this.next();
            const def = this.def();

            return { type: "export", exportTok, def };
        }

        return this.def();
    }

    def() {
        if (this.is("kw", "var")) {
            const kw = this.next();
            const doc = this.lastComment;
            const name = this.next("ident");
            this.skip("punc", ":");
            const var_type = this.type();

            return { type: "var-def", kw, doc, name, var_type };
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

            let generic;

            if (this.is("op", "<")) {
                generic = this.list("<,>", () => this.next('ident'), "op");
            }

            const body = this.list("{}", this.file);

            return {
                type: "class-def",
                kw,
                doc,
                name,
                generic,
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
        
        if (this.is("op", "<")) {
            const generic = this.list("<,>", this.type, "op");
            return { type: "generic", name, generic }
        }
        
        return { type: "simple", name };
    }

    list(cond, parse, tokType = 'punc') {
        if (cond.length == 3) {
            const list = [];
            const sep = [];

            const startTok = this.next(tokType, cond[0]);

            if (this.hasError()) return { startTok, list, sep };

            if (this.is(tokType, cond[2])) {
                const endTok = this.next();
                return { startTok, list, sep, endTok };
            }

            while (this.has) {
                list.push(parse.call(this));

                if (this.is(tokType, cond[2])) {
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

                list.push(parse.call(this));;

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
