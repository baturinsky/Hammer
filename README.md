# Hammer
Typescript microframework. Contains events and json serializer.

##Freezer

Freezer class can serialise objects in strings. 

* Resolves circular references
* Recovers class protoypes
* You can tell it which classes and objects should not be serialised, but should be re-linked with when deserialised
* You can tell it which classes and objects should not be serialised at all

Usage example:

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
