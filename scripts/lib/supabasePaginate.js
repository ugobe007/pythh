/**
 * Paginate PostgREST selects past the default ~1000 row cap.
 * @param {(rangeFrom: number, rangeTo: number) => Promise<{ data: any[]|null, error: Error|null }>} fetchPage
 * @param {number} [pageSize=1000]
 * @returns {Promise<any[]>}
 */
async function fetchAllPages(fetchPage, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

module.exports = { fetchAllPages };
