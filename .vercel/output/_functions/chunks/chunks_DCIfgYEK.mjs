function chunks(arr, size) {
  if (arr.length === 0) return [];
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
const SQL_BATCH_SIZE = 50;

export { SQL_BATCH_SIZE, chunks };
