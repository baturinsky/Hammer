var log = console.log.bind(console)
var ownProp = {}.hasOwnProperty

function applyMixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            derivedCtor.prototype[name] = baseCtor.prototype[name];
        });
    });
}

function importProperties(obj, src) {
    for (var key in src)
        if (ownProp.call(src, key))
            obj[key] = src[key]
    return obj
}

class Uids {
    prefixes: { [key: string]: number } = {}

    static default = new Uids()

    make(prefix = '') {
        this.prefixes[prefix] = this.prefixes[prefix] || 0
        return prefix + " " + ++this.prefixes[prefix]
    }
}

class Graveyard<T> {
    deceased:T[] = []
    constructor(public type) {
    }
    bury(corpse: T) {
        this.deceased.push(corpse)
    }
    raise(): T {
        if (this.deceased.length)
            return this.deceased.pop()
        else
            return new this.type()
    }
}

class ChainLink<T> {
    prv: ChainLink<T>
    nxt: ChainLink<T>

    constructor(public value?: T) {
    }

    remove() {
        this.prv.nxt = this.nxt
        this.nxt.prv = this.prv
        return this
    }

    insertNodeBefore(node: ChainLink<T>) {
        node.nxt = this
        node.prv = this.prv
        this.prv.nxt = node
        this.prv = node
        return node
    }

    insertNodeAfter(node: ChainLink<T>) {
        node.prv = this
        node.nxt = this.nxt
        this.nxt.prv = node
        this.nxt = node
        return node
    }

    insertBefore(value: T) { return this.insertNodeBefore(new ChainLink(value)) }
    insertAfter(value: T) { return this.insertNodeAfter(new ChainLink(value)) }

    each(f: (t: T) => void) {
        var iter = this.nxt
        while (iter != this) {
            f(iter.value)
            iter = iter.nxt
        }
    }

    eachNode(f: (t: ChainLink<T>) => void) {
        var iter = this.nxt
        while (iter != this) {
            f(iter)
            iter = iter.nxt
        }
    }

    empty() { return this.nxt == this }
    purge() { this.nxt = this.prv = this }

    first() { return this.nxt }
    last() { return this.prv }

    pushNode: (l: ChainLink<T>)=>ChainLink<T> = ChainLink.prototype.insertNodeBefore
    unshiftNode: (l: ChainLink<T>)=>ChainLink<T> = ChainLink.prototype.insertNodeAfter

    push: (v: T) => ChainLink<T> = ChainLink.prototype.insertBefore
    unshift: (v: T) => ChainLink<T>  = ChainLink.prototype.insertAfter

}

class Chain<T> extends ChainLink<T> {
    constructor() {
        super()
        this.nxt = this.prv = this
    }

    removeNode(node: ChainLink<T>) {
        return node.remove()
    }
}

class Channel {
    subs = new Chain<(any)>()

    subscribe(callback: (any) => void, parameters?: any) {
        var binding = this.subs.push(callback)
        if (parameters)
            importProperties(binding, parameters)
        return binding
    }

    static simpleEmitCallback(binding: ChainLink<any>) {
        binding.value.call(binding)
    }

    emit(parameters?: any) {
        if(parameters)
            this.subs.eachNode(function (binding) { binding.value.call(binding, parameters) })
        else
            this.subs.eachNode(Channel.simpleEmitCallback)
    }

    static doOnceAndRemove = function (...args) {
        this.TactualCallback(args)
        this.remove()
    }

    once(callback: (any) => void, parameters?: any) {
        (this.subscribe(Channel.doOnceAndRemove, parameters) as any).TactualCallback = callback
    }
}

class Channels {
    channel: { [key: string]: Channel } = {}

    on(event: string, callback: (any) => void, parameters?: any) {
        var relevant = this.channel[event] = (this.channel[event] || new Channel())
        relevant.subscribe(callback, parameters)
    }

    emit(event: string, parameters?: any) {
        var relevant = this.channel[event]
        if (relevant)
            relevant.emit(parameters)
    }

    once(event: string, callback: (any) => void, parameters?: any) {
        var relevant = this.channel[event]
        if (relevant)
            relevant.once(callback, parameters)
    }
}

class Freezer {
    freezableClasses: { [key: string]: any } = {}
    staticObjects: any[] = []
    uids: Uids = Uids.default

    constructor(freezableClasses?: any[], staticClasses?: any[], staticObjects?: any[]) {
        /*
        if (freezableClasses)
            this.addFreezableClasses(freezableClasses)
        if(staticClasses)
            this.addStaticClasses(staticClasses)
        if(staticObjects)
            this.addStaticObjects(staticObjects)
        */
    }

    addFreezableClasses(freezableClasses) {
        var self = this
        for (let C of freezableClasses) {
            this.freezableClasses[C.name] = C
            C.prototype.Tid = C.prototype.Tid || function () {
                this.id = this.id || self.uids.make(C.name)
                return this.id
            }
        }
        return this
    }

    addStaticClasses(staticClasses: any[]) {
        var self = this
        for (let C of staticClasses) {
            C.prototype.Tstringifier = C.prototype.Tstringifier || function () {
                this.id = this.id || self.uids.make('Tuf')
                self.staticObjects[this.id] = this
                return { Tuf: this.id }
            }
        }
        return this
    }

    addStaticObjects(staticObjects: any[]) {
        for (let o of staticObjects) {
            var id = o.id || this.uids.make('Tuf')
            this.staticObjects[id] = o
            o.Tstringifier = function () {
                return { Tuf: id }
            }
        }
        return this
    }

    static voidFunction() {}

    addIgnoredClasses(ignoredClasses: any[]) {
        for (let C of ignoredClasses)
            C.prototype.Tstringifier = Freezer.voidFunction
        return this
    }

    addIgnoredObjects(ignoredObjects: any[]) {
        for (let o of ignoredObjects)
            o.Tstringifier = Freezer.voidFunction
        return this
    }

    freeze(model: any): string {
        var Tclassed = []
        var processed = {}

        var stringified = JSON.stringify(model, function (k, v) {
            if (v) {
                if (v.Tstringifier) {
                    return v.Tstringifier()
                }
                else if (v.Tid) {
                    if (processed[v.Tid()])
                        return { Tref: v.Tid() }
                    else
                        processed[v.Tid()] = true
                }

                if (v.constructor) {
                    v.Tclass = v.constructor.name
                    Tclassed.push(v)
                }

                return v
            }            
        })

        return stringified
    }


    thaw(source: string) {
        class Ref {
            constructor(public parent: any, public key: string, public ref: string) { }
        }

        var freezableClasses = this.freezableClasses
        var statics = this.staticObjects

        var objectsWithIds = {}
        var references: Ref[] = []

        var model = JSON.parse(source, function (k: string, v) {
            if (k == 'id')
                objectsWithIds[v] = this
            if (k == 'Tclass') {
                this.__proto__ = freezableClasses[v].prototype
                return
            }
            if (v != null) {
                if (v.Tref)
                    references.push(new Ref(this, k, v.Tref))
                if (v.Tuf)
                    return statics[v.Tuf]
            }
            return v
        })

        for (let ref of references) {
            ref.parent[ref.key] = objectsWithIds[ref.parent[ref.key].Tref]
        }

        return model
    }

}

function test() {
    class Fur {
    }

    class Slick extends Fur {
    }

    class Fluffy extends Fur {
    }

    class GameObject {
        constructor(public sprite: String) { }
    }

    class Animal {
        screams: () => any
        fur: Fur
        likes: Animal
        go: GameObject
        constructor(public name: string) { }
    }

    class House {
        animals: Animal[]
        constructor(list: Animal[]) {
            this.animals = [].concat(list)
        }
    }

    var dog = new Animal("dog")
    var cat = new Animal("cat")
    var llama = new Animal("llama")

    cat.fur = new Fluffy()

    dog.likes = cat
    cat.likes = llama

    cat.go = new GameObject("cat.jpg")

    var house = new House([dog, cat, llama])

    function meow() { log("meow") }

    cat.screams = meow

    

    var fridge = new Freezer()
        .addFreezableClasses([Animal, House])
        .addStaticClasses([Fur])
        .addStaticObjects([meow])
        .addIgnoredClasses([GameObject])
        .addIgnoredObjects([llama])

    log(house)

    var frozen = fridge.freeze(house)

    log(frozen)

    var thawed: House = fridge.thaw(frozen)

    log(thawed)

    thawed.animals[1].screams()

    log(thawed.animals[1].fur)
}

test()