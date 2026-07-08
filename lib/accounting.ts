import type postgres from "postgres";

type SqlClient = postgres.TransactionSql<Record<string, unknown>>;

/**
 * Posts the one-way auto-link from a successful cash closing into the accounting
 * ledger (spec-07 section 5): an income transaction on the store's default cash
 * account, tagged source='cash_closing' so it can't be edited directly in the
 * ledger UI — only by editing the cash_closings row it came from (see syncCashClosingTransaction).
 *
 * `ledgerAmount` must be the NEW cash this closing represents — countedAmount minus
 * the opening float carried in from the previous closing — not the raw counted total.
 * The opening float is the same physical cash already recorded as income last shift;
 * posting the full counted amount every time would double-count it on every
 * subsequent closing (openingFloat carries forward via getCashClosingExpected()).
 *
 * created_by is the store owner (the closest stand-in for "system" — the PIN-authenticated
 * employee who closed the shift is not an admin and can't be the actor of record here).
 * Best-effort: if the store has no default account/system category yet (shouldn't
 * happen post-migration, but defensive), silently skips rather than failing the closing.
 */
export async function postCashClosingTransaction(
  tx: SqlClient, storeId: number | string, cashClosingId: number, ledgerAmount: number, businessDate: string
): Promise<void> {
  const [store] = await tx`SELECT owner_id FROM stores WHERE id = ${storeId}`;
  if (!store) return;

  const [account] = await tx`
    SELECT id FROM accounts WHERE store_id = ${storeId} AND is_default_cash = true AND archived_at IS NULL
    FOR UPDATE
  `;
  if (!account) return;

  const [category] = await tx`
    SELECT id FROM transaction_categories WHERE store_id = ${storeId} AND type = 'income' AND is_system = true LIMIT 1
  `;
  if (!category) return;

  await tx`UPDATE accounts SET current_balance = current_balance + ${ledgerAmount} WHERE id = ${account.id}`;
  await tx`
    INSERT INTO transactions (store_id, account_id, category_id, type, amount, business_date, source, source_ref_id, created_by)
    VALUES (${storeId}, ${account.id}, ${category.id}, 'income', ${ledgerAmount}, ${businessDate}::date, 'cash_closing', ${cashClosingId}, ${store.owner_id})
  `;
}

/**
 * Re-syncs the linked transaction's amount (and the account balance) when an
 * already-closed cash_closings record is corrected. Takes `countedAmountDelta`
 * (newCountedAmount - oldCountedAmount) rather than a recomputed absolute ledger
 * amount — since only the last shift of the day posts to the ledger (see
 * isLastShiftOfDay in lib/cashClosing.ts), the linked transaction's amount isn't
 * simply countedAmount minus this row's own opening_float; nudging it by the same
 * delta the count changed by is correct regardless of which shift this is or
 * whether it's the day's ledger-posting closing. No-op if no linked transaction
 * exists — e.g. this closing was never the last shift of its day, so it never
 * posted anything to correct in the first place.
 */
export async function syncCashClosingTransaction(
  tx: SqlClient, cashClosingId: number, countedAmountDelta: number
): Promise<void> {
  if (countedAmountDelta === 0) return;

  const [linked] = await tx`
    SELECT t.id, t.amount, a.id as account_id FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.source = 'cash_closing' AND t.source_ref_id = ${cashClosingId}
    FOR UPDATE
  `;
  if (!linked) return;

  const newAmount = Number(linked.amount) + countedAmountDelta;
  await tx`UPDATE accounts SET current_balance = current_balance + ${countedAmountDelta} WHERE id = ${linked.account_id}`;
  await tx`UPDATE transactions SET amount = ${newAmount} WHERE id = ${linked.id}`;
}
