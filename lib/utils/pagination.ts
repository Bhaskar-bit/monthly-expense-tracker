export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    hasMore: boolean
    totalPages: number
  }
}

export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

export function createPaginatedResult<T>(data: T[], page: number, pageSize: number, total: number): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
}

export function validatePaginationParams(page: number, pageSize: number): PaginationParams {
  return {
    page: Math.max(PAGINATION_DEFAULTS.DEFAULT_PAGE, Math.floor(page)),
    pageSize: Math.min(
      Math.max(PAGINATION_DEFAULTS.MIN_PAGE_SIZE, Math.floor(pageSize)),
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    ),
  }
}
