export default class File {
    #path
    
    constructor(path) {
        this.#path = path
    }
    
    exists() {
        return this.name in JSON.parse(localStorage.getItem(this.parent.path))
    }
    
    create() {
        try {
            const data = JSON.parse(localStorage.getItem(this.parent.path) || "{}")
            data[this.name] = 'file'
            localStorage.setItem(this.path, '')
            localStorage.setItem(this.parent.path, JSON.stringify(data))
            
            return true
        } catch (err) {
            console.error(err)
            return false
        }
    }

    mkdir() {
        try {
            const data = JSON.parse(localStorage.getItem(this.parent.path))
            data[this.name] = 'dir'
            localStorage.setItem(this.path, '{}')
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

    get is_file() {
        if (this.path === '/') return false
        return JSON.parse(localStorage.getItem(this.parent.path))[this.name] === 'file'
    }

    get is_dir() {
        if (this.path === '/') return true
        return JSON.parse(localStorage.getItem(this.parent.path))[this.name] === 'dir'
    }

    get list() {
        return Object.keys(JSON.parse(localStorage.getItem(this.path)))
    }

    get files() {
        return this.list.map(name => this.child(name))
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

    toString() {
        return this.path
    }
}

if (!localStorage.getItem('/')) {
    localStorage.setItem('/', '{}')
}
