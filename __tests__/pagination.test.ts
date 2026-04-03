import { describe, it, expect } from "vitest"
import {
  calculateOffset,
  createPaginatedResult,
  validatePaginationParams,
  PAGINATION_DEFAULTS,
} from "../lib/utils/pagination"

describe("calculateOffset", () => {
  it("page 1 returns offset 0", () => {
    expect(calculateOffset(1, 20)).toBe(0)
  })

  it("page 2 with size 20 returns offset 20", () => {
    expect(calculateOffset(2, 20)).toBe(20)
  })

  it("page 3 with size 10 returns offset 20", () => {
    expect(calculateOffset(3, 10)).toBe(20)
  })
})

describe("createPaginatedResult", () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ id: i }))

  it("sets hasMore=true when more pages exist", () => {
    const result = createPaginatedResult(items, 1, 5, 15)
    expect(result.pagination.hasMore).toBe(true)
    expect(result.pagination.totalPages).toBe(3)
  })

  it("sets hasMore=false on the last page", () => {
    const result = createPaginatedResult(items, 3, 5, 15)
    expect(result.pagination.hasMore).toBe(false)
  })

  it("returns the data untouched", () => {
    const result = createPaginatedResult(items, 1, 5, 5)
    expect(result.data).toBe(items)
  })
})

describe("validatePaginationParams", () => {
  it("clamps page to minimum of 1", () => {
    expect(validatePaginationParams(0, 20).page).toBe(1)
    expect(validatePaginationParams(-5, 20).page).toBe(1)
  })

  it("clamps pageSize to MAX_PAGE_SIZE", () => {
    expect(validatePaginationParams(1, 999).pageSize).toBe(PAGINATION_DEFAULTS.MAX_PAGE_SIZE)
  })

  it("clamps pageSize to MIN_PAGE_SIZE", () => {
    expect(validatePaginationParams(1, 0).pageSize).toBe(PAGINATION_DEFAULTS.MIN_PAGE_SIZE)
  })

  it("accepts valid params unchanged", () => {
    const result = validatePaginationParams(2, 25)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(25)
  })
})
