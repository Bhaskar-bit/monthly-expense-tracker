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
 * Group raw lines into records. A record begins at a line starting with a
 * date and runs until the next such line — this is what makes wrapped
 * narration (the long UPI reference strings) safe to handle.
 */
function groupRecords(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const records: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (DATE_RE.test(line)) {
      if (current) records.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
    // Lines before the first date are header/branding — dropped.
  }
  if (current) records.push(current);
  return records;
}

/**
 * The payee name, when ICICI supplies one, sits on its own line between the
 * date and the UPI string. Identify it by exclusion: not a date, not a
 * transaction-code string, not purely numeric.
 */
function extractMerchant(bodyLines: string[]): string | null {
  for (const line of bodyLines) {
    if (DATE_RE.test(line)) continue;
    if (/^(UPI|ACH|NEFT|IMPS|RTGS|ATM|POS|MMT|BIL)\//i.test(line)) continue;
    if (/^[\d,.\s]+$/.test(line)) continue;
    if (line.length < 2) continue;
    return line.replace(/\s+/g, ' ').trim();
  }
  return null;
}

function extractVpa(narration: string): string | null {
  const m = narration.match(/\/([A-Za-z0-9._-]+@[A-Za-z]+)\//);
  return m ? m[1] : null;
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
    const joined = record.join(' ');
    // Balance-carried markers, not transactions. ICICI prints B/F at the top of
    // the statement and both B/F and C/F around page breaks; treating either as
    // a transaction invents a zero-amount row and drags a warning with it.
    if (/\bB\/F\b/.test(joined) || /\bC\/F\b/.test(joined)) continue;
    const dateMatch = record[0].match(DATE_RE)!;
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
    const bodyLines = record.slice(1);

    transactions.push({
      date,
      amount: Math.round(amount * 100) / 100,
      direction,
      balanceAfter,
      merchant: extractMerchant(record[0].replace(DATE_RE, '').trim() ? record : bodyLines),
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
    openingBalance: opening,
    closingBalance: prevBalance,
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
