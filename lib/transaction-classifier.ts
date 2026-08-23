/**
 * Classification for parsed ICICI transactions.
 *
 * Rules first, model last. ICICI's MODE column is a strong deterministic
 * signal — it separates investments, internal transfers, card spend and cash
 * withdrawals without any inference at all. Only what survives the rules is
 * worth spending a model call on, and once a merchant is resolved it is
 * written to category_training_data and never asked about again.
 *
 * Categories are constrained to the ten already accepted by the expenses
 * table. Anything not confidently mapped becomes Miscellaneous with low
 * confidence, which surfaces it for review rather than burying it.
 */

import type { ParsedTxn } from './icici-statement-parser';

export type Category =
  | 'Investments'
  | 'EMIs'
  | 'Monthly Fixed Expenses'
  | 'Cab Expense'
  | 'Food Apps Expense'
  | 'Quick Order Apps Expense'
  | 'Shopping Apps Expense'
  | 'Travel Expenses'
  | 'Credit card bills'
  | 'Miscellaneous';

/** What the money actually is, independent of which category it lands in. */
export type Kind = 'EXPENSE' | 'INCOME' | 'TRANSFER_INTERNAL' | 'TRANSFER_SAVINGS';

export interface Classified {
  category: Category;
  kind: Kind;
  confidence: number;        // 0..1
  source: 'mode' | 'learned' | 'merchant-rule' | 'model' | 'fallback';
  reason: string;
}

/**
 * MODE codes, per the legend block ICICI prints on every statement.
 * These are the highest-confidence signals available.
 */
const MODE_RULES: Record<string, Partial<Classified> & { kind: Kind }> = {
  EBA:  { kind: 'TRANSFER_SAVINGS', category: 'Investments', confidence: 0.97, reason: 'ICICIDirect transaction' },
  ISEC: { kind: 'TRANSFER_SAVINGS', category: 'Investments', confidence: 0.97, reason: 'ICICIDirect transaction' },
  INF:  { kind: 'TRANSFER_INTERNAL', category: 'Miscellaneous', confidence: 0.95, reason: 'Transfer between linked own accounts' },
  NFS:  { kind: 'EXPENSE', category: 'Miscellaneous', confidence: 0.9, reason: 'ATM cash withdrawal' },
  VAT:  { kind: 'EXPENSE', category: 'Miscellaneous', confidence: 0.9, reason: 'ATM cash withdrawal' },
  MAT:  { kind: 'EXPENSE', category: 'Miscellaneous', confidence: 0.9, reason: 'ATM cash withdrawal' },
  TOP:  { kind: 'EXPENSE', category: 'Monthly Fixed Expenses', confidence: 0.9, reason: 'Mobile recharge' },
  ACH:  { kind: 'EXPENSE', category: 'EMIs', confidence: 0.85, reason: 'Mandate / auto-debit' },
};

/** Merchant-name rules. Extend freely — these cost nothing and never drift. */
const MERCHANT_RULES: Array<{ test: RegExp; category: Category; kind: Kind; reason: string }> = [
  { test: /zerodha|groww|bse\s*star|cams|kfin|nps|protean|ppf|mutual\s*fund/i,
    category: 'Investments', kind: 'TRANSFER_SAVINGS', reason: 'Investment platform' },
  { test: /uber|ola|rapido|blusmart/i,
    category: 'Cab Expense', kind: 'EXPENSE', reason: 'Ride hailing' },
  { test: /swiggy|zomato|eatsure|wow\s*momo|dominos|pizza|cafe|restaurant|ice\s*cream/i,
    category: 'Food Apps Expense', kind: 'EXPENSE', reason: 'Food' },
  { test: /blinkit|zepto|instamart|bigbasket|dunzo|dairy|kirana|grocer/i,
    category: 'Quick Order Apps Expense', kind: 'EXPENSE', reason: 'Quick commerce / grocery' },
  { test: /amazon|flipkart|myntra|ajio|nykaa|meesho/i,
    category: 'Shopping Apps Expense', kind: 'EXPENSE', reason: 'Shopping' },
  { test: /irctc|indigo|vistara|air\s*india|makemytrip|goibibo|redbus|oyo|booking\.com/i,
    category: 'Travel Expenses', kind: 'EXPENSE', reason: 'Travel' },
  { test: /credit\s*card|cc\s*payment|card\s*pmt|autopay|billdesk/i,
    category: 'Credit card bills', kind: 'EXPENSE', reason: 'Card bill payment' },
  { test: /electricity|mseb|gas|broadband|airtel|jio|vodafone|insurance|premium|rent/i,
    category: 'Monthly Fixed Expenses', kind: 'EXPENSE', reason: 'Recurring household' },
];

export interface Registry {
  /** Last-4 or identifying fragments of the user's own accounts. */
  ownAccounts: string[];
  /** Narration fragments identifying salary credits. */
  incomePatterns: RegExp[];
}

/**
 * @param learned  merchant -> category, loaded from category_training_data.
 *                 Checked before any rule so a user correction always wins.
 */
export function classify(
  txn: ParsedTxn,
  registry: Registry,
  learned: Map<string, Category>
): Classified {
  const key = (txn.merchant ?? '').trim().toLowerCase();

  // 1. A correction the user has already made outranks everything.
  if (key && learned.has(key)) {
    return {
      category: learned.get(key)!,
      kind: txn.direction === 'credit' ? 'INCOME' : 'EXPENSE',
      confidence: 0.99,
      source: 'learned',
      reason: 'Previously confirmed for this merchant',
    };
  }

  // 2. Income, before anything tries to categorise it as spending.
  if (txn.direction === 'credit') {
    const isSalary = registry.incomePatterns.some(p => p.test(txn.narration));
    return {
      category: 'Miscellaneous',
      kind: 'INCOME',
      confidence: isSalary ? 0.95 : 0.5,
      source: isSalary ? 'merchant-rule' : 'fallback',
      reason: isSalary ? 'Matches salary pattern' : 'Unidentified credit — refund or income?',
    };
  }

  // 3. Own-account transfer, whatever the mode says.
  if (registry.ownAccounts.some(a => a && txn.narration.includes(a))) {
    return {
      category: 'Miscellaneous',
      kind: 'TRANSFER_INTERNAL',
      confidence: 0.96,
      source: 'merchant-rule',
      reason: 'Counterparty is one of your own accounts',
    };
  }

  // 4. MODE column — the bank's own classification.
  if (txn.mode && MODE_RULES[txn.mode]) {
    const r = MODE_RULES[txn.mode];
    return {
      category: r.category as Category,
      kind: r.kind,
      confidence: r.confidence ?? 0.85,
      source: 'mode',
      reason: `MODE ${txn.mode}: ${r.reason}`,
    };
  }

  // 5. Merchant name rules.
  const name = `${txn.merchant ?? ''} ${txn.narration}`;
  for (const rule of MERCHANT_RULES) {
    if (rule.test.test(name)) {
      return {
        category: rule.category,
        kind: rule.kind,
        confidence: 0.88,
        source: 'merchant-rule',
        reason: rule.reason,
      };
    }
  }

  // 6. Nothing matched. Low confidence is the point — it routes to review
  //    rather than quietly landing in Miscellaneous forever.
  return {
    category: 'Miscellaneous',
    kind: 'EXPENSE',
    confidence: 0.3,
    source: 'fallback',
    reason: 'No rule matched — needs review or a model pass',
  };
}

/**
 * Auto-confirm threshold.
 *
 * A row auto-confirms only if the parser reconciled it AND the classifier is
 * confident. Reconciliation is about the amount being right; confidence is
 * about the category being right. Both have to hold, because a confidently
 * categorised wrong amount is still a wrong number in your report.
 */
export function shouldAutoConfirm(txn: ParsedTxn, c: Classified): boolean {
  return txn.reconciled && c.confidence >= 0.85;
}
