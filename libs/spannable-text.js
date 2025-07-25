export default class SpannableText {
    #spans = []
    #input
    
    constructor(input) {
        this.#input = input
        this.#spans.push({ start: 0, end: input.length })
    }
    
    get text() {
        return this.#input
    }
    
    color(start, end, color) {
        // if (start == end) return
        
        for(let i = 0; i < this.#spans.length; i++) {
            const span = this.#spans[i]
            
            if (start == span.start) {
                if (end < span.end) {
                    const newSpan = { start: end, end: span.end, color: span.color }
                    span.end = end
                    span.color = color
                    this.#spans.splice(i + 1, 0, newSpan)
                    return
                }
                
                if (end == span.end) {
                    span.color = color
                    return
                }
                
                if (end > span.end) {
                    span.color = color
                    start = span.end
                }
            }
            
            if (start > span.start && end < span.end) {
                const newSpan1 = { start, end, color }
                const newSpan2 = { start: end, end: span.end, color: span.color }
                    
                span.end = start
                this.#spans.splice(i + 1, 0, newSpan1, newSpan2)
                return
            }
            
            if (start > span.start && end == span.end) {
                const newSpan = { start, end, color }
                    
                span.end = start
                this.#spans.splice(i + 1, 0, newSpan)
                return
            }
        }
    }
    
    error(start, end) {        
        for(let i = 0; i < this.#spans.length; i++) {
            const span = this.#spans[i]
            
            if (start == span.start) {
                if (end < span.end) {
                    const newSpan = { start: end, end: span.end, color: span.color }
                    span.end = end
                    span.error = true
                    this.#spans.splice(i + 1, 0, newSpan)
                    return
                }
                
                if (end == span.end) {
                    span.error = true
                    return
                }
                
                if (end > span.end) {
                    span.error = true
                    start = span.end
                }
            }
            
            if (start > span.start && end < span.end) {
                const newSpan1 = { start, end, color: span.color, error: true }
                const newSpan2 = { start: end, end: span.end, color: span.color }
                    
                span.end = start
                this.#spans.splice(i + 1, 0, newSpan1, newSpan2)
                return
            }
            
            if (start > span.start && end == span.end) {
                const newSpan = { start, end, color: span.color, error: true }
                    
                span.end = start
                this.#spans.splice(i + 1, 0, newSpan)
                return
            }
        }
    }
    
    toString() {
        return this.#spans.map(span => {
            const text = html_encode(this.#input.slice(span.start, span.end) || ' ')
            const classes = []
            
            if (span.color) classes.push(span.color)
            if (span.error) classes.push('tok-err')
            
            if (classes.length) return `<span class="${classes.join(' ')}">${text}</span>`
            return text
        }).join('')
    }
}

function html_encode(text) {
    return text.replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
}