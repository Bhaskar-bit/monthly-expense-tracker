/**
 * PDF text extraction for password-protected bank statements.
 *
 * Uses pdfjs-dist rather than pdf-parse: pdf-parse cannot open encrypted
 * documents at all, and every ICICI e-statement is encrypted.
 *
 *   npm i pdfjs-dist
 *
 * Note the legacy build import — the modern build assumes browser APIs that
 * are absent in the Node runtime Vercel uses for API routes.
 */

// @ts-ignore - legacy build has no bundled types
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export class WrongPasswordError extends Error {
  constructor() {
    super('Statement password was rejected.');
    this.name = 'WrongPasswordError';
  }
}

/**
 * Extract text with layout roughly preserved.
 *
 * Items are grouped into lines by their y-coordinate rather than taken in
 * document order. This matters: PDF text items are emitted in whatever order
 * the renderer wrote them, so a naive join interleaves the balance column
 * into the middle of the narration. Grouping by y and sorting by x rebuilds
 * the visual row, which is what the parser expects.
 */
export async function extractStatementText(
  data: Uint8Array,
  password?: string
): Promise<string> {
  // The loading task, not the document proxy, owns destroy() in pdfjs 6 — keep
  // a reference to it so the worker is torn down on every path out of here.
  const task = pdfjs.getDocument({
    data,
    password,
    // Vercel's Node runtime has no system font stack, and text extraction does
    // not need glyphs — only the text layer and its coordinates.
    useSystemFonts: false,
    verbosity: 0,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err: any) {
    await task.destroy().catch(() => {});
    if (err?.name === 'PasswordException') throw new WrongPasswordError();
    throw err;
  }

  const pages: string[] = [];

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();

      // Bucket by rounded y. Tolerance of 2 units absorbs sub-pixel drift
      // between items that are visually on the same line.
      const rows = new Map<number, Array<{ x: number; text: string }>>();

      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 2) * 2;
        const x = item.transform[4];
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ x, text: item.str });
      }

      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])                       // top of page downwards
        .map(([, items]) =>
          items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim()
        )
        .filter(Boolean);

      pages.push(lines.join('\n'));
    }
  } finally {
    await task.destroy().catch(() => {});
  }

  return pages.join('\n');
}

/**
 * ICICI statement passwords follow the pattern:
 *   first four letters of the account holder's name + date of birth
 *
 * Case and date format vary in practice, so generate the plausible variants
 * and try each rather than hard-coding one guess. Trying five candidates
 * costs microseconds; a wrong guess costs a failed import every month.
 *
 * @param namePrefix first four letters of the name
 * @param dob        date of birth as DDMMYYYY
 */
export function passwordCandidates(namePrefix: string, dob: string): string[] {
  const n = namePrefix.replace(/[^A-Za-z]/g, '').slice(0, 4);
  const digits = dob.replace(/\D/g, '');
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  const names = [n.toUpperCase(), n.toLowerCase(), n[0]?.toUpperCase() + n.slice(1).toLowerCase()];
  const dates = [`${dd}${mm}`, `${dd}${mm}${yyyy.slice(2)}`, `${dd}${mm}${yyyy}`];

  const out: string[] = [];
  for (const name of names) for (const date of dates) out.push(`${name}${date}`);
  return [...new Set(out)];
}

export async function extractWithCandidates(
  data: Uint8Array,
  candidates: string[]
): Promise<string> {
  for (const pw of candidates) {
    try {
      return await extractStatementText(data, pw);
    } catch (err) {
      if (err instanceof WrongPasswordError) continue;
      throw err;
    }
  }
  throw new WrongPasswordError();
}
