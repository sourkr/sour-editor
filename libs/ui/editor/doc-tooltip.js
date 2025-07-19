export default class DocToolTipManager {
	constructor(tooltip) {
		this.tooltip = tooltip;
		this.symbol = tooltip.querySelector(".symbol");
		this.doc = tooltip.querySelector(".doc");
	}

	showAnchor(type, anchor) {
		const rect = anchor.getBoundingClientRect();
		this.showAt(type, rect.top, rect.right)
	}

	showAt(type, x, y) {
		if (!type) return;

		this.symbol.innerHTML = type_to_doc_html(type);

		if (type.doc) {
			this.doc.style.display = "block";
			this.doc.innerHTML = this.formatDocComment(type.doc);
		} else {
			this.doc.style.display = "none";
		}
		
		this.tooltip.style.display = "block";

		this.tooltip.style.top = `${x}px`;
		this.tooltip.style.left = `${y}px`;
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
	}
}

function type_to_doc_html(type) {
	if (type.type === "func") {
		const kw = span("tok-kw", "func");
		const name = span("tok-func-call", type.name);

		console.log(type.params)

		const params = type.params
			.map((param) => `${span("tok-var", param.name)}: ${type_to_html(param.type)}`)
			.join(",");

		return `${kw} ${name}(${params}): ${type_to_html(type.retType)}`;
	}

	if (type.type == "simple") {
		if (type.is_param) {
			return `<span style="color:grey">(param)</span> ${this.span("tok-var", type.param_name)}: ${this.span("tok-type", type.name)}`;
		}

		if (type.is_var) {
			return `${this.span("tok-def", "var")} ${this.span("tok-var", type.var_name)}: ${this.span("tok-type", type.name)}`;
		}

		return `${this.span("tok-type", type.name)}`;
	}

	if (type.type == "class") {
		if (type.is_type) {
			return `<span style="color:grey">(type)</span> ${this.span("tok-type", type.name)}`;
		} else {
			return `${this.span("tok-def", "class")} ${this.span("tok-type", type.name)}`;
		}
	}
}

function type_to_html(type) {
	if (!type) return;

	if (type.type === "class" || type.type === 'simple') {
		return span("tok-type", type.name);
	}

	return span("dim", '(error)')
}

function span(color, data) {
	return `<span class="${color}">${data}</span>`;
}