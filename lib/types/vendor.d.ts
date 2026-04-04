// Type stubs for optional import packages.
// These are declared here so TypeScript doesn't error when the packages
// haven't been installed yet. Real types are provided by @types/* once installed.

declare module "papaparse" {
  interface ParseResult<T> { data: T[]; errors: unknown[]; meta: unknown }
  interface ParseConfig { header?: boolean; skipEmptyLines?: boolean; trimHeaders?: boolean }
  function parse<T>(input: string, config?: ParseConfig): ParseResult<T>
  export default { parse }
}

declare module "xlsx" {
  interface WorkBook { SheetNames: string[]; Sheets: Record<string, unknown> }
  function read(data: Buffer, opts?: { type?: string; cellDates?: boolean }): WorkBook
  const utils: {
    sheet_to_json<T>(sheet: unknown, opts?: { raw?: boolean; defval?: unknown; range?: number }): T[]
  }
  export { read, utils }
}

declare module "pdf-parse" {
  interface PDFData { text: string; numpages: number }
  function pdfParse(buffer: Buffer): Promise<PDFData>
  export default pdfParse
}
