export function normalizeArray<T> (arr: T[]): T | undefined {
  return Array.isArray(arr) ? arr[0] : arr
}
