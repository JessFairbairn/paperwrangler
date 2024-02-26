export class Counter {
    _counts: {[x: string]: number};

    constructor() {
        this._counts = {};
    }

    add(stringValue) {
        if(this._counts[stringValue]) {
            this._counts[stringValue]++;
        } else{
            this._counts[stringValue] = 1;
        }
    }

    update(iterable) {
        for (let str of iterable) {
            this.add(str);
        }
    }

    get(stringValue) {
        return this._counts[stringValue]
    }

    getAll() {
        return this._counts;
    }

    getAllOrdered() {
        let countDict = this._counts;
        let itemList =  Object.keys(countDict).map(function(key) {
            return [key, countDict[key]];
        });
        //@ts-expect-error
        itemList.sort((a, b) => a[1] - b[1]);
        
        itemList.reverse();

        return itemList;
    }

    getResultsWithMin(min: number) {
        let filtered = Object.fromEntries(Object.entries(this._counts).filter(([k,v]) => v>=min));
        return filtered;
    }

    getResultsInRange(min: number, max: number) {
        let filtered = Object.fromEntries(Object.entries(this._counts).filter(([k,v]) => v>=min && v<=max));
        return filtered;
    }

    getMaxCount() {
        return 
    }

    getHistogram(): number[] {
        let maxCount = Math.max(...Object.values(this._counts));

        let histogramArray: number[] = [];
        for (let i = 0; i <= maxCount; i++) {
            histogramArray.push(Object.values(this._counts).filter(refCount => refCount === i).length);
        }
        return histogramArray;
    }
}