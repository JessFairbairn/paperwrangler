export function partitionArray<T>(array: Array<T>, isValid: (a: T) => Boolean): T[][] {
    return array.reduce(([pass, fail], elem) => {
      return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
    }, [[], []]);
  }