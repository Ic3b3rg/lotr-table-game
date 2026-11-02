/** Pinned mscorlib Comparison<T> path; equal-key order and comparisons matter. */
export function comparisonSort<T>(values: T[], comparison: (a: T, b: T) => number): void {
  if (typeof comparison !== 'function') throw new TypeError('Comparatore assente.');
  const get = (index: number): T => {
    if (index < 0 || index >= values.length)
      throw new RangeError('Comparatore incoerente: indice fuori dalla lista.');
    return values[index]!;
  };
  const compare = (a: T, b: T): number => {
    const result = comparison(a, b);
    if (!Number.isInteger(result) || result < -2147483648 || result > 2147483647)
      throw new RangeError('Il comparatore deve restituire un signed int32.');
    return result;
  };
  const swap = (a: number, b: number): void => {
    if (a === b) return;
    const value = get(a);
    values[a] = get(b);
    values[b] = value;
  };
  const swapIfGreater = (a: number, b: number): void => {
    if (a !== b && compare(get(a), get(b)) > 0) swap(a, b);
  };
  const insertionSort = (low: number, high: number): void => {
    for (let i = low; i < high; i++) {
      let j = i;
      const value = get(i + 1);
      while (j >= low && compare(value, get(j)) < 0) {
        values[j + 1] = get(j);
        j--;
      }
      values[j + 1] = value;
    }
  };
  const downHeap = (initial: number, count: number, low: number): void => {
    let i = initial;
    const value = get(low + i - 1);
    while (i <= Math.trunc(count / 2)) {
      let child = 2 * i;
      if (child < count && compare(get(low + child - 1), get(low + child)) < 0) child++;
      if (compare(value, get(low + child - 1)) >= 0) break;
      values[low + i - 1] = get(low + child - 1);
      i = child;
    }
    values[low + i - 1] = value;
  };
  const heapSort = (low: number, high: number): void => {
    const count = high - low + 1;
    for (let i = Math.trunc(count / 2); i >= 1; i--) downHeap(i, count, low);
    for (let i = count; i > 1; i--) {
      swap(low, low + i - 1);
      downHeap(1, i - 1, low);
    }
  };
  const partition = (low: number, high: number): number => {
    const middle = low + Math.trunc((high - low) / 2);
    swapIfGreater(low, middle);
    swapIfGreater(low, high);
    swapIfGreater(middle, high);
    const pivot = get(middle);
    swap(middle, high - 1);
    let left = low,
      right = high - 1;
    while (left < right) {
      do {
        left++;
      } while (compare(get(left), pivot) < 0);
      do {
        right--;
      } while (compare(pivot, get(right)) < 0);
      if (left >= right) break;
      swap(left, right);
    }
    swap(left, high - 1);
    return left;
  };
  const introSort = (low: number, initialHigh: number, initialDepth: number): void => {
    let high = initialHigh,
      depth = initialDepth;
    while (high > low) {
      const size = high - low + 1;
      if (size <= 16) {
        if (size === 2) swapIfGreater(low, high);
        else if (size === 3) {
          swapIfGreater(low, high - 1);
          swapIfGreater(low, high);
          swapIfGreater(high - 1, high);
        } else insertionSort(low, high);
        return;
      }
      if (depth === 0) {
        heapSort(low, high);
        return;
      }
      depth--;
      const pivot = partition(low, high);
      introSort(pivot + 1, high, depth);
      high = pivot - 1;
    }
  };
  if (values.length < 2) return;
  let bits = 0;
  for (let n = values.length; n >= 1; n = Math.trunc(n / 2)) bits++;
  introSort(0, values.length - 1, 2 * bits);
}
