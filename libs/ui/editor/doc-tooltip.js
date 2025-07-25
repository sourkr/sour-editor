export default class DocToolTipManager {
	constructor(tooltip) {
		this.tooltip = tooltip;
		this.symbol = tooltip.querySelector(".symbol");
		this.doc = tooltip.querySelector(".doc");
	}

	showAnchor(type, anchor) {
		const rect = anchor.getBoundingClientRect();
		this.showAt(type, rect.right, rect.top);
	}

	showAt(type, x, y, gravity) {
		if (!type) return;

		this.symbol.innerHTML = type_to_doc_html(type);

		if (type.doc) {
			this.doc.style.display = "block";
			this.doc.innerHTML = this.formatDocComment(type.doc);
		} else {
			this.doc.style.display = "none";
		}

		this.tooltip.style.display = "block";

		this.tooltip.style.left = `${x}px`;

		if (gravity == "bottom") {
			this.tooltip.style.bottom = `${y}px`;
			this.tooltip.style.top = `auto`;
		} else {
			this.tooltip.style.top = `${y}px`;
			this.tooltip.style.bottom = `auto`;
		}

		const rect = this.tooltip.getBoundingClientRect();

		if (rect.top < 0) {
			this.tooltip.style.top = `calc(${innerHeight - y}px + 2em)`;
			this.tooltip.style.bottom = `auto`;
		}

		this.is_visible = true
	}

	formatDocComment(docString) {
		if (!docString) return "";

		// Remove JSDoc block start/end and leading asterisks
		const cleanedDoc = docString
			.replace(/^\/\*\*\s*/, "") // Remove /** at the beginning
			.replace(/\s*\*\/$/, "") // Remove */ at the end
			.split("\n")
			.map((line) => line.replace(/^\s*\*\s?/, "").trim()) // Remove leading * and trim
			.filter((line) => line !== ""); // Remove empty lines

		let description = [];
		let params = [];
		let returns = "";

		for (const line of cleanedDoc) {
			if (line.startsWith("@param")) {
				params.push(line.substring("@param".length).trim());
			} else if (line.startsWith("@returns")) {
				returns = line.substring("@returns".length).trim();
			} else {
				description.push(line);
			}
		}

		let html = "";
		if (description.length > 0) {
			html += `<p>${description.join("<br>")}</p>`;
		}

		if (params.length > 0) {
			html += "<h4>Parameters:</h4><ul>";
			for (const param of params) {
				// Expected format: {paramName} {description}
				const match = param.match(/^(\S+)\s+(.*)/);
				if (match) {
					html += `<li><strong>${match[1]}</strong>: ${match[2]}</li>`;
				} else {
					html += `<li>${param}</li>`;
				}
			}
			html += "</ul>";
		}

		if (returns) {
			html += `<h4>Returns:</h4><p>${returns}</p>`;
		}

		return html;
	}

	hide() {
		this.tooltip.style.display = "none";
		this.is_visible = false
	}
}

function type_to_doc_html(type) {
	// console.log(type)
	
	if (type.type === "func") {
		const kw = span("tok-kw", "func");
		const name = span("tok-func-call", type.name);

		const params = type.params
			.map((param) => `${span("tok-var", param.name)}: ${type_to_html(param.type)}`)
			.join(",");

		return `${kw} ${name}(${params}): ${type_to_html(type.retType)}`;
	}

	if (type.type == "simple") {
		return `${span('dim', '(type)')} ${span("tok-type", type.name)}`;
	}

	if (type.type == "class") {
		if (type.is_param) {
			return `${span('dim', '(param)')} ${span("tok-var", type.param_name)}: ${type_to_html(type)}`
		}

		if (type.is_prop) {
			return `${span('dim', '(property)')} ${span("tok-type", type.class_name)}.${span("tok-var", type.prop_name)}: ${type_to_html(type)}`
		}

		if (type.is_var) {
			return `${span('tok-def', 'var')} ${span("tok-var", type.var_name)}: ${type_to_html(type)}`
		}
		
		if (type.is_type) {
			return `${span('dim', '(type)')} ${span("tok-type", type.name)}`;
		}
		
		return `${span("tok-def", "class")} ${type_to_html(type)}`;
	}

	
	if (type.type == "ins") {
		if (type.is_var) {
			return `${span('tok-def', 'var')} ${span("tok-var", type.var_name)}: ${type_to_html(type)}`
		}
		
		return `${span("tok-def", "class")} ${span("tok-type", type.cls.name)}<${type.generic.map(type_to_html).join(', ')}>`
	}
}

function type_to_html(type) {
	if (!type) return;

	if (type.type === "simple") {
		return span("tok-type", type.name);
	}

	if (type.type === "class") {
		if (type.generic) {
			return `${span("tok-type", type.name)}<${type.generic.map(type_to_html).join(', ')}>`
		}
		
		return span("tok-type", type.name);
	}
	
	if (type.type == "ins") {
		return `${span("tok-type", type.cls.name)}<${type.generic.map(type_to_html).join(', ')}>`
	}

	if (typeof type == 'string') {
		return span("tok-type", type);
	}
	
	return span("dim", "(error)");
}

function span(color, data) {
	return `<span class="${color}">${data}</span>`;
}
