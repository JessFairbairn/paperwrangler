export class TupleSet {
    // from https://stackoverflow.com/a/67459614/1525648

    data: Map<any,any> = new Map(); 
    done: boolean = false;

    add([first, second]) {
        if (!this.data.has(first)) {
            this.data.set(first, new Set());
        }

        this.data.get(first).add(second);
        return this;
    }

    has([first, second]) {
        return (
            this.data.has(first) &&
            this.data.get(first).has(second)
        );
    };

    delete([first, second]) {
        if (!this.data.has(first) ||
            !this.data.get(first).has(second)) return false;

        this.data.get(first).delete(second);
        if (this.data.get(first).size === 0) {
            this.data.delete(first);
        }

        return true;
    };

    * next() {
        for (let key of this.data) {
            for (let item of key[1]) {
                yield [key[0], item];
            }
        }
        this.done = true;
        return;
    }

    [Symbol.iterator] = this.next;
}
