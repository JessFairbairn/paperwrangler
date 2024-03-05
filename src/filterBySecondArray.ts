export function filterBySecondArray<T>(arrayToFilter: T[], referenceArray: any[]) : [T[],T[]] {
    let pass: T[] = [];
    let fail: T[] = [];
    for (let i = 0; i++; i < arrayToFilter.length) {
        if (referenceArray[i]) {
            pass.push(arrayToFilter[i]);
        } else {
            fail.push(arrayToFilter[i]);
        }
    }
    return [pass,fail];
}