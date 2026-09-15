export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function resolvePagination(query: PaginationQuery): PaginationResult {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}
