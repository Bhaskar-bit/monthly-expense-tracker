/**
 * ICICI savings statement parser.
 *
 * Design note — why the balance column is load-bearing:
 *
 * PDF text extraction collapses the DEPOSITS and WITHDRAWALS columns into a
 * single whitespace-separated run. Given "1,408.00 658.49" there is nothing
 * positional to tell you whether 1,408.00 was money in or money out — and
 * getting that backwards flips the sign on a transaction, which corrupts both
 * the spending total and the savings rate at once.
 *
 * BALANCE is a running total, so the delta between consecutive rows gives the
 * direction with certainty, and the magnitude independently. This parser
 * therefore reads the printed amount AND computes the delta, uses the delta
 * for direction, and flags any row where the two disagree rather than
 * silently preferring one.
 */

export type Direction = 'debit' | 'credit';

export interface ParsedTxn {
  date: string;              // ISO yyyy-mm-dd
  amount: number;            // always positive
  direction: Direction;
  balanceAfter: number;
  merchant: string | null;   // clean payee name when ICICI supplies one
  mode: string | null;       // UPI | ACH | NEFT | IMPS | ATM | ...
  counterpartyVpa: string | null;
  narration: string;         // full joined text, kept verbatim
  reconciled: boolean;       // false => needs human review
}

export interface ParseResult {
  transactions: ParsedTxn[];
  accountLast4?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  /** Closing balance as printed on the statement's totals row, if present. */
  printedClosingBalance: number | null;
  warnings: string[];
}

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})\b/;
const AMOUNT_RE = /\d{1,3}(?:,\d{2,3})*\.\d{2}/g;
// ISEC, VAT, MAT and TOP are matched here as well as in MODE_RULES — a code the
// classifier knows about is useless if the parser never surfaces it.
const MODE_RE = /\b(UPI|ACH|NEFT|IMPS|RTGS|ATM|POS|EBA|ISEC|BIL|MMT|INF|SI|VPS|NFS|VAT|MAT|TOP)\b/;

/** "1,408.00" -> 1408.00 */
function toNumber(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

function toIso(dd: string, mm: string, yyyy: string): string {
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Column headers, page furniture and the per-page totals row. None of these
 * carry a date, so without removing them they get appended to whichever
 * transaction happens to precede them — and the totals row in particular ends
 * with three currency figures, which then masquerade as that transaction's
 * amount and balance.
 */
const NOISE_RE =
  /^(?:DATE\b|MODE\b|PARTICULARS\b|DEPOSITS\b|WITHDRAWALS\b|BALANCE\b|Total\s*:|Statement of Transactions\b|Page\s+\d+|MODE\*\*)/i;

/**
 * A line is a payee name if it reads like one: some letters, and none of the
 * slash-delimited reference structure that every UPI/NEFT/ACH string carries.
 * Rules out the wrapped tails ("7b", "4e/", "0/") and the reference lines
 * themselves, both of which sit adjacent to the name in the extracted text.
 */
function looksLikeName(line: string): boolean {
  if (!line || line.includes('/')) return false;
  if (DATE_RE.test(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3;
}

export interface RawRecord {
  lines: string[];
  /** Payee name printed above the dated line, when ICICI supplies one. */
  merchant: string | null;
}

/**
 * Group raw lines into records.
 *
 * A record begins at a dated line and runs to the next one. The subtlety is
 * the payee name: ICICI prints it as the FIRST line of the PARTICULARS block,
 * while the date is vertically centred against the middle of that block. In
 * extracted text the name therefore appears *before* the dated line, not
 * after it — so scanning forwards from the date finds a reference fragment
 * ("BANK/743917241826/AXIee91c...") and never the payee. Look back instead.
 */
function groupRecords(text: string): RawRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !NOISE_RE.test(l));

  const records: RawRecord[] = [];
  let current: RawRecord | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (DATE_RE.test(line)) {
      if (current) records.push(current);
      const previous = lines[i - 1];
      current = {
        lines: [line],
        merchant: previous && looksLikeName(previous)
          ? previous.replace(/\s+/g, ' ').trim()
          : null,
      };
    } else if (current) {
      current.lines.push(line);
    }
    // Lines before the first date are header/branding — dropped.
  }
  if (current) records.push(current);
  return records;
}

/**
 * The printed totals row, which is the closing balance this statement format
 * offers in place of a C/F record. Its last figure is the running balance
 * carried to the end of the page, so the final occurrence is the statement's
 * closing balance.
 */
function extractPrintedClosing(text: string, opening: number | null): number | null {
  if (opening === null) return null;

  const rows = [...text.matchAll(/^\s*Total\s*:.*$/gim)].map(m => m[0]);

  // A statement-level totals row carries three figures — deposits, withdrawals
  // and the balance they produce — and those three must reconcile against the
  // opening balance. Requiring that proves we found the right row instead of
  // some other table that happens to start with "Total:". Taking the last row
  // blindly produced a closing balance of 1011.77 from a row that was nothing
  // of the sort, and turned a clean parse into a false "rows are missing".
  for (let i = rows.length - 1; i >= 0; i--) {
    const figures = rows[i].match(AMOUNT_RE);
    if (!figures || figures.length < 3) continue;

    const balance = toNumber(figures[figures.length - 1]);
    const withdrawals = toNumber(figures[figures.length - 2]);
    const deposits = toNumber(figures[figures.length - 3]);

    if (Math.abs(opening + deposits - withdrawals - balance) < 0.01) return balance;
  }

  return null;
}

function extractVpa(narration: string): string | null {
  const m = narration.match(/\/([A-Za-z0-9._-]+@[A-Za-z]+)\//);
  return m ? m[1] : null;
}

/**
 * One "Statement of Transactions in ... Account ..." block.
 *
 * A single ICICI PDF commonly carries several: a PPF account is printed above
 * the savings account, each with its own B/F, its own running balance and its
 * own totals row.
 */
export interface AccountSection {
  label: string;              // 'Savings', 'PPF', ...
  accountLast4: string | null;
  body: string;
  datedLines: number;
}

const SECTION_RE =
  /Statement of Transactions in\s+(.+?)\s+(?:Account|A\/c)\s+X*(\d{4})\b/gi;

/**
 * Split the text into per-account sections.
 *
 * Parsing a multi-account statement as one chain is not a small error: the
 * balance runs off the end of one account and into the first row of the next,
 * so that row's movement is the gap between two unrelated balances. It also
 * double-counts, since a PPF credit is the far side of a savings debit that is
 * already in the statement.
 */
export function splitAccountSections(text: string): AccountSection[] {
  const matches = [...text.matchAll(SECTION_RE)];
  const countDated = (s: string) =>
    s.split(/\r?\n/).filter(l => DATE_RE.test(l.trim())).length;

  if (matches.length === 0) {
    return [{ label: '', accountLast4: null, body: text, datedLines: countDated(text) }];
  }

  // The header is reprinted at the top of every page, so one account produces
  // many matches. Merging by account number is the whole point: treating each
  // occurrence as its own account splits a statement into per-page fragments
  // and then keeps only the largest, silently discarding most of the rows.
  const byAccount = new Map<string, AccountSection>();

  matches.forEach((m, i) => {
    const start = m.index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : undefined;
    const body = text.slice(start, end);
    const last4 = m[2];

    const existing = byAccount.get(last4);
    if (existing) {
      existing.body += '\n' + body;
      existing.datedLines += countDated(body);
    } else {
      byAccount.set(last4, {
        label: m[1].trim(),
        accountLast4: last4,
        body,
        datedLines: countDated(body),
      });
    }
  });

  return [...byAccount.values()];
}

/**
 * The account this tracker is about. Savings is where spending happens; a PPF
 * or deposit section holds the other half of transfers already recorded on the
 * savings side. Falls back to the busiest section when nothing is labelled
 * savings, since that is where the transactions are.
 */
function selectSection(sections: AccountSection[]): AccountSection {
  const savings = sections.filter(s => /saving/i.test(s.label));
  const pool = savings.length > 0 ? savings : sections;
  return pool.reduce((best, s) => (s.datedLines > best.datedLines ? s : best), pool[0]);
}

/**
 * Parse an ICICI statement from extracted PDF text.
 *
 * @param text            raw text from the PDF
 * @param openingBalance  balance immediately before the first transaction.
 *                        Read it from the statement summary. Without it the
 *                        first row cannot be reconciled and is flagged.
 */
export function parseIciciStatement(
  text: string,
  openingBalance?: number
): ParseResult {
  const warnings: string[] = [];

  const sections = splitAccountSections(text);
  const section = selectSection(sections);
  const ignored = sections.filter(s => s !== section && s.datedLines > 0);

  if (ignored.length > 0) {
    warnings.push(
      `Statement covers ${sections.length} accounts. Read ${
        section.label || 'the busiest section'
      } A/c ...${section.accountLast4 ?? '????'}; ignored ${ignored
        .map(s => `${s.label} A/c ...${s.accountLast4} (${s.datedLines} rows)`)
        .join(', ')}. Transfers between your own accounts appear once, on the savings side.`
    );
  }

  // Everything below reads the selected account only.
  text = section.body;
  const records = groupRecords(text);
  const transactions: ParsedTxn[] = [];

  // ICICI prints the opening balance as a B/F record. Prefer it over any
  // caller-supplied value: it comes from the statement itself and cannot drift.
  let prevBalance: number | null = openingBalance ?? null;
  const bf = text.match(/\b\d{2}-\d{2}-\d{4}\s+B\/F\s+([\d,]+\.\d{2})/);
  if (bf) {
    prevBalance = toNumber(bf[1]);
  } else if (prevBalance === null) {
    warnings.push(
      'No B/F row found and no opening balance supplied — the first transaction is unverified.'
    );
  }

  let printedDeposits = 0;
  let printedWithdrawals = 0;

  for (const record of records) {
    const joined = record.lines.join(' ');
    // Balance-carried markers, not transactions. ICICI prints B/F at the top of
    // the statement and both B/F and C/F around page breaks; treating either as
    // a transaction invents a zero-amount row and drags a warning with it.
    if (/\bB\/F\b/.test(joined) || /\bC\/F\b/.test(joined)) continue;
    const dateMatch = record.lines[0].match(DATE_RE)!;
    const date = toIso(dateMatch[1], dateMatch[2], dateMatch[3]);

    // The balance is the LAST currency-formatted number in the record.
    // Amount columns are deliberately not read (see header comment).
    const amounts = joined.match(AMOUNT_RE);
    if (!amounts || amounts.length === 0) {
      warnings.push(`${date}: no balance found, record skipped — ${joined.slice(0, 80)}`);
      continue;
    }

    const balanceAfter = toNumber(amounts[amounts.length - 1]);

    // Printed amount: the currency value immediately preceding the balance.
    const printed = amounts.length > 1 ? toNumber(amounts[amounts.length - 2]) : null;

    let amount = 0;
    let direction: Direction = 'debit';
    let reconciled = false;

    if (prevBalance !== null) {
      const delta = prevBalance - balanceAfter;
      direction = delta > 0 ? 'debit' : 'credit';
      const derived = Math.abs(delta);

      if (printed !== null && Math.abs(printed - derived) < 0.01) {
        // Printed amount and balance movement agree — highest confidence.
        amount = printed;
        reconciled = true;
      } else if (printed === null) {
        amount = derived;
        reconciled = true;
        warnings.push(`${date}: no printed amount found, taken from balance movement.`);
      } else {
        // They disagree. Trust the balance chain (it is arithmetic, not layout)
        // but flag the row so it is never auto-confirmed.
        amount = derived;
        reconciled = false;
        warnings.push(
          `${date}: printed ${printed} vs balance movement ${derived} — flagged for review.`
        );
      }

      if (printed !== null) {
        if (direction === 'debit') printedWithdrawals += printed;
        else printedDeposits += printed;
      }

      if (derived < 0.005) {
        reconciled = false;
        warnings.push(`${date}: balance did not move — possible misparse, flagged.`);
      }
    } else {
      // First row, no opening balance: nothing to reconcile against.
      amount = printed ?? 0;
      warnings.push(`${date}: first row unverified — supply an opening balance.`);
    }

    const modeMatch = joined.match(MODE_RE);

    transactions.push({
      date,
      amount: Math.round(amount * 100) / 100,
      direction,
      balanceAfter,
      merchant: record.merchant,
      mode: modeMatch ? modeMatch[1] : null,
      counterpartyVpa: extractVpa(joined),
      narration: joined.replace(/\s+/g, ' ').trim(),
      reconciled,
    });

    prevBalance = balanceAfter;
  }

  // Independent cross-check. The printed amount columns and the balance column
  // are extracted from different parts of the layout, so agreement between them
  // is real evidence the extraction was clean rather than a tautology.
  const opening = bf ? toNumber(bf[1]) : (openingBalance ?? null);
  if (opening !== null && prevBalance !== null) {
    const byBalance = prevBalance - opening;
    const byPrinted = printedDeposits - printedWithdrawals;
    if (Math.abs(byBalance - byPrinted) > 0.01) {
      warnings.push(
        `Column cross-check failed: balance moved ${byBalance.toFixed(2)} but printed ` +
        `amounts total ${byPrinted.toFixed(2)}. Extraction is unreliable — do not auto-confirm.`
      );
    }
  }

  return {
    transactions,
    accountLast4: section.accountLast4,
    openingBalance: opening,
    closingBalance: prevBalance,
    printedClosingBalance: extractPrintedClosing(text, opening),
    warnings,
  };
}

/**
 * Integrity check to run before anything is written to import_transactions.
 *
 * If the closing balance derived from the chain does not match the closing
 * balance printed on the statement, transactions are missing. In that case
 * the import must not auto-confirm — a statement that silently drops rows
 * understates spending, which is exactly the failure that makes a tracker
 * worse than useless.
 */
export function verifyChain(
  result: ParseResult,
  printedClosingBalance: number
): { ok: boolean; discrepancy: number; message: string } {
  const derived = result.closingBalance ?? 0;
  const discrepancy = Math.round((derived - printedClosingBalance) * 100) / 100;

  if (Math.abs(discrepancy) < 0.01) {
    return { ok: true, discrepancy: 0, message: 'Balance chain reconciles.' };
  }
  return {
    ok: false,
    discrepancy,
    message:
      `Chain ends at ${derived} but statement says ${printedClosingBalance} ` +
      `(off by ${discrepancy}). Rows are missing or misparsed — do not auto-confirm.`,
  };
}
