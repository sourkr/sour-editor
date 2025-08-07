const PROPERTIES = new Set([
	'boxSizing', 'width', 'height', 'overflow', 'border', 'padding',
	'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing',
	'whiteSpace', 'wordWrap', 'textAlign'
])

export default class Cursor {
	#textarea
	#lineno = 0
	
	/** 
	 * @hidden
	 * @param {HTMLTextAreaElement} textarea
	 */
	constructor(textarea) {
		this.#textarea = textarea
	}
	
	/** @hidden */
	_update(editor) {
		const lines = editor._getLines()
		const index = this.#textarea.selectionStart
		let total = 0
		
		for (let i = 0; i < lines.length; i++) {
			total += lines[i].length + 1 // +1 for newline
			if (index < total) {
				this.#lineno = i
				break
			}
		}
	}
	
	get index() {
		return this.#textarea.selectionStart
	}
	
	set index(val) {
		this.#textarea.selectionStart = this.#textarea.selectionEnd = val
	}
	
	get lineno() {
		return this.#lineno
	}
	
	get y() {
		return this._getCaretCoords().top
	}
	
	get x() {
		return this._getCaretCoords().left
	}
	
	_getCaretCoords() {
		const textarea = this.#textarea
		const index = textarea.selectionStart
		
		const div = document.createElement('div')
		const style = getComputedStyle(textarea)
		
		PROPERTIES.forEach(prop => div.style[prop] = style[prop])
		
		// Additional mirror setup
		div.style.position = 'absolute'
		div.style.visibility = 'hidden'
		div.style.whiteSpace = 'pre-wrap'
		div.style.wordWrap = 'break-word'
		
		div.textContent = textarea.value.substring(0, index)
		
		const span = document.createElement('span')
		span.textContent = textarea.value.substring(index) || '.'
		div.appendChild(span)
		
		document.body.appendChild(div)
		const { offsetLeft: left, offsetTop: top } = span
		document.body.removeChild(div)
		
		return { left, top }
	}
}