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

/**
 * pdfjs 6 evaluates `new DOMMatrix()` at module scope. Those globals come from
 * a browser or from @napi-rs/canvas, and the Vercel Node runtime has neither —
 * the module throws ReferenceError before a single page is read. Every use of
 * them is on the canvas rasterisation path, which text extraction never walks,
 * so stubs are enough to get the module loaded without a 30MB native
 * dependency. Installed before the import, hence the dynamic import below.
 */
function installCanvasStubs(): void {
  const g = globalThis as Record<string, unknown>;

  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: number[] | string) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
      translate() { return this; }
      scale() { return this; }
      invertSelf() { return this; }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
    };
  }

  if (typeof g.Path2D === 'undefined') {
    g.Path2D = class Path2DStub {
      addPath() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
    };
  }

  if (typeof g.ImageData === 'undefined') {
    g.ImageData = class ImageDataStub {
      constructor(public width = 0, public height = 0) {}
    };
  }
}

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Load pdfjs once per process, after the stubs are in place. */
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    installCanvasStubs();
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

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
  const pdfjs = await loadPdfjs();

  // pdfjs TRANSFERS this buffer to its worker rather than copying it, leaving
  // the caller's array detached with byteLength 0. Anything that retries — a
  // second password candidate, say — would then hand pdfjs an empty buffer and
  // get DataCloneError instead of the real answer. Copy so the caller's array
  // survives the call.
  const owned = new Uint8Array(data);

  // The loading task, not the document proxy, owns destroy() in pdfjs 6 — keep
  // a reference to it so the worker is torn down on every path out of here.
  const task = pdfjs.getDocument({
    data: owned,
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
  const tried = new Set<string>();

  for (const pw of candidates) {
    if (tried.has(pw)) continue;   // a duplicate costs a whole PDF parse
    tried.add(pw);
    try {
      return await extractStatementText(data, pw);
    } catch (err) {
      if (err instanceof WrongPasswordError) continue;
      throw err;
    }
  }
  throw new WrongPasswordError();
}
