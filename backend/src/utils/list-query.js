function parsePagination(filters = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let limit = Number(filters.limit);
  if (!Number.isFinite(limit) || limit <= 0) {
    limit = defaultLimit;
  }
  limit = Math.min(Math.floor(limit), maxLimit);

  let page = Number(filters.page);
  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }
  page = Math.floor(page);

  const offset = (page - 1) * limit;

  return { limit, offset, page };
}

function resolveSort(filters = {}, sortMap, defaultKey, defaultDir = 'desc') {
  const key = Object.prototype.hasOwnProperty.call(sortMap, filters.sort_by)
    ? filters.sort_by
    : defaultKey;
  const dir = filters.sort_dir || defaultDir;
  const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${sortMap[key]} ${direction}`;
}

function buildPaginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1)
  };
}

module.exports = {
  parsePagination,
  resolveSort,
  buildPaginationMeta
};
