import { clsx } from 'clsx';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { controlClass, FormField, Select, Switch } from '@/components/ui/controls';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { formatDay } from '@/lib/dates';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatPaise, paiseToInput, parseRupees } from '@/lib/money';
import { CATEGORY_LABEL, useAddEntry, useCreateAccount, useMatchBalance, useReverseEntry, useTransfer, useUpdateAccount, type Account, type Entry } from './api';

/** Rupee amount field with a ₹ prefix. Keeps what the user typed; parse with `parseRupees`. */
export function AmountInput({ id, value, onChange, autoFocus, large, allowNegative }: { id: string; value: string; onChange: (value: string) => void; autoFocus?: boolean; large?: boolean; allowNegative?: boolean }) {
  return (
    <div className="relative">
      <span className={clsx('pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-gray-400', large ? 'text-lg' : 'text-sm')}>₹</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, ''))}
        className={clsx(controlClass, 'w-full pl-8 font-mono font-bold', large && 'h-12 text-xl sm:text-xl')}
      />
    </div>
  );
}

/**
 * Explains why the calendar stops where it does: an account can't take entries
 * dated before its opening date, because that money is already in its opening balance.
 */
export function earliestDateHint(account: Pick<Account, 'name' | 'openingDate'> | undefined) {
  return account ? `Earliest date is ${formatDay(account.openingDate)}, when ${account.name} starts.` : undefined;
}

/** Reads a balance that may be below zero (an overdraft), e.g. "-2500". Null when it isn't a number. */
export function readSigned(input: string): number | null {
  const negative = input.trim().startsWith('-');
  const magnitude = parseRupees(input.replace(/-/g, ''));
  if (magnitude == null || Number.isNaN(magnitude)) return null;
  return negative ? -magnitude : magnitude;
}

/** Reads an amount field: paise, or an error message for the user. */
export function readAmount(input: string, { allowZero = false } = {}): { paise: number } | { error: string } {
  const paise = parseRupees(input);
  if (paise == null) return { error: 'Enter an amount' };
  if (Number.isNaN(paise)) return { error: 'Enter a valid amount, like 1500 or 1500.50' };
  if (paise === 0 && !allowZero) return { error: 'Enter an amount more than zero' };
  return { paise };
}

function AccountSelect({ id, accounts, value, onChange, exclude }: { id: string; accounts: Account[]; value: number | null; onChange: (id: number) => void; exclude?: number | null }) {
  return (
    <Select id={id} className="w-full" value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))}>
      {value == null && <option value="">Choose an account…</option>}
      {accounts
        .filter((account) => account.isActive && account.id !== exclude)
        .map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {formatPaise(account.balancePaise)}
          </option>
        ))}
    </Select>
  );
}

function Actions({ onCancel, saving, label, tone }: { onCancel: () => void; saving: boolean; label: string; tone?: 'danger' }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={saving}>
        {label}
      </Button>
    </div>
  );
}

/** Shows what a balance will become, so the effect of the form is clear before saving. */
function BalancePreview({ label, before, after }: { label: string; before: number; after: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-xs">
      <span className="min-w-0 truncate font-medium text-gray-600">{label}</span>
      <span className="flex shrink-0 items-center gap-2 font-mono font-bold tabular-nums">
        <span className="text-gray-500">{formatPaise(before)}</span>
        <ArrowRight className="size-3 text-gray-400" aria-hidden />
        <span className={after < 0 ? 'text-rose-600' : 'text-neutral-900'}>{formatPaise(after)}</span>
      </span>
    </div>
  );
}

/* ── Money in / Money out ─────────────────────────────────────────────── */

export type EntryDialogState = { direction: 'in' | 'out'; accountId: number | null } | null;

export function EntryDialog({ state, accounts, categories, today, onClose }: { state: EntryDialogState; accounts: Account[]; categories: { expense: string[]; income: string[] }; today: string; onClose: () => void }) {
  const out = state?.direction === 'out';
  return (
    <Modal size="md" open={state != null} onClose={onClose} title={out ? 'Money out' : 'Money in'} description={out ? 'An expense paid from one of your accounts.' : 'Money received that isn’t from an order.'}>
      {state && <EntryForm key={`${state.direction}-${state.accountId}`} state={state} accounts={accounts} categories={categories} today={today} onDone={onClose} />}
    </Modal>
  );
}

function EntryForm({ state, accounts, categories, today, onDone }: { state: NonNullable<EntryDialogState>; accounts: Account[]; categories: { expense: string[]; income: string[] }; today: string; onDone: () => void }) {
  const add = useAddEntry();
  const out = state.direction === 'out';
  const [requestId] = useState(() => crypto.randomUUID());
  const [accountId, setAccountId] = useState<number | null>(state.accountId ?? accounts.find((a) => a.isActive)?.id ?? null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const account = accounts.find((a) => a.id === accountId);
  const parsed = readAmount(amount);
  const signed = 'paise' in parsed ? (out ? -parsed.paise : parsed.paise) : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if (!account) problems.accountId = 'Choose an account';
    if ('error' in parsed) problems.amountPaise = parsed.error;
    if (!category) problems.category = 'Choose what this is for';
    if (description.trim().length < 3) problems.description = out ? 'Say what this was paid for' : 'Say where this money came from';
    if (account?.kind === 'cash' && out && 'paise' in parsed && parsed.paise > account.balancePaise) problems.amountPaise = `Cash in hand is only ${formatPaise(account.balancePaise)}`;
    setErrors(problems);
    if (Object.keys(problems).length || !account || 'error' in parsed) return;
    try {
      await add.mutateAsync({ requestId, accountId: account.id, direction: state.direction, amountPaise: parsed.paise, entryDate, category, description: description.trim() });
      toast(`${formatPaise(parsed.paise)} ${out ? 'paid from' : 'added to'} ${account.name}`);
      onDone();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="Amount" htmlFor="entry-amount" error={errors.amountPaise}>
        <AmountInput id="entry-amount" value={amount} onChange={setAmount} autoFocus large />
      </FormField>
      <FormField label={out ? 'Paid from' : 'Received in'} htmlFor="entry-account" error={errors.accountId}>
        <AccountSelect id="entry-account" accounts={accounts} value={accountId} onChange={setAccountId} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={out ? 'What for' : 'What is it'} htmlFor="entry-category" error={errors.category}>
          <Select id="entry-category" className="w-full" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Choose…</option>
            {(out ? categories.expense : categories.income).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key] ?? key}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Date" htmlFor="entry-date" error={errors.entryDate} hint={earliestDateHint(account)}>
          <DatePicker id="entry-date" className="w-full" value={entryDate} onChange={setEntryDate} max={today} min={account?.openingDate} />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="entry-description" error={errors.description} hint="Shown in the statement, so write it the way you’ll recognise it later.">
        <input id="entry-description" className={`${controlClass} w-full`} maxLength={160} placeholder={out ? 'e.g. Shop rent for October' : 'e.g. Owner added funds'} value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
      {account && signed !== 0 && <BalancePreview label={`${account.name} balance`} before={account.balancePaise} after={account.balancePaise + signed} />}
      <Actions onCancel={onDone} saving={add.isPending} label={out ? 'Save money out' : 'Save money in'} />
    </form>
  );
}

/* ── Transfer / deposit cash to bank ──────────────────────────────────── */

export type TransferDialogState = { fromAccountId: number | null; toAccountId: number | null } | null;

export function TransferDialog({ state, accounts, today, onClose }: { state: TransferDialogState; accounts: Account[]; today: string; onClose: () => void }) {
  const from = accounts.find((a) => a.id === state?.fromAccountId);
  const deposit = from?.kind === 'cash';
  return (
    <Modal size="md" open={state != null} onClose={onClose} title={deposit ? 'Deposit cash to bank' : 'Transfer between accounts'} description={deposit ? 'Record cash you have paid into the bank.' : 'Move money from one of your accounts to another.'}>
      {state && <TransferForm key={`${state.fromAccountId}-${state.toAccountId}`} state={state} accounts={accounts} today={today} onDone={onClose} />}
    </Modal>
  );
}

function TransferForm({ state, accounts, today, onDone }: { state: NonNullable<TransferDialogState>; accounts: Account[]; today: string; onDone: () => void }) {
  const move = useTransfer();
  const active = accounts.filter((a) => a.isActive);
  const [requestId] = useState(() => crypto.randomUUID());
  const [fromId, setFromId] = useState<number | null>(state.fromAccountId ?? active[0]?.id ?? null);
  const [toId, setToId] = useState<number | null>(state.toAccountId ?? active.find((a) => a.id !== (state.fromAccountId ?? active[0]?.id))?.id ?? null);
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const parsed = readAmount(amount);
  const paise = 'paise' in parsed ? parsed.paise : 0;
  const earliest = [from?.openingDate, to?.openingDate].filter(Boolean).sort().at(-1);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if (!from) problems.fromAccountId = 'Choose where the money comes from';
    if (!to) problems.toAccountId = 'Choose where the money goes';
    if (from && to && from.id === to.id) problems.toAccountId = 'Choose a different account';
    if ('error' in parsed) problems.amountPaise = parsed.error;
    else if (from?.kind === 'cash' && parsed.paise > from.balancePaise) problems.amountPaise = `Cash in hand is only ${formatPaise(from.balancePaise)}`;
    setErrors(problems);
    if (Object.keys(problems).length || !from || !to || 'error' in parsed) return;
    try {
      await move.mutateAsync({ requestId, fromAccountId: from.id, toAccountId: to.id, amountPaise: parsed.paise, entryDate, note: note.trim() });
      toast(`${formatPaise(parsed.paise)} moved from ${from.name} to ${to.name}`);
      onDone();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="Amount" htmlFor="transfer-amount" error={errors.amountPaise}>
        <AmountInput id="transfer-amount" value={amount} onChange={setAmount} autoFocus large />
        {from?.kind === 'cash' && from.balancePaise > 0 && (
          <button type="button" className="mt-1.5 text-xs font-bold text-neutral-900 underline underline-offset-2" onClick={() => setAmount(paiseToInput(from.balancePaise))}>
            Deposit all {formatPaise(from.balancePaise)}
          </button>
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="From" htmlFor="transfer-from" error={errors.fromAccountId}>
          <AccountSelect id="transfer-from" accounts={accounts} value={fromId} onChange={setFromId} />
        </FormField>
        <FormField label="To" htmlFor="transfer-to" error={errors.toAccountId}>
          <AccountSelect id="transfer-to" accounts={accounts} value={toId} onChange={setToId} exclude={fromId} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" htmlFor="transfer-date" error={errors.entryDate} hint={earliestDateHint([from, to].filter((a) => a?.openingDate === earliest)[0])}>
          <DatePicker id="transfer-date" className="w-full" value={entryDate} onChange={setEntryDate} max={today} min={earliest} />
        </FormField>
        <FormField label="Note (optional)" htmlFor="transfer-note">
          <input id="transfer-note" className={`${controlClass} w-full`} maxLength={120} placeholder="e.g. Deposit slip 4471" value={note} onChange={(event) => setNote(event.target.value)} />
        </FormField>
      </div>
      {from && to && from.id !== to.id && paise > 0 && (
        <div className="space-y-2">
          <BalancePreview label={from.name} before={from.balancePaise} after={from.balancePaise - paise} />
          <BalancePreview label={to.name} before={to.balancePaise} after={to.balancePaise + paise} />
        </div>
      )}
      <Actions onCancel={onDone} saving={move.isPending} label={from?.kind === 'cash' ? 'Save deposit' : 'Save transfer'} />
    </form>
  );
}

/* ── Match with bank ──────────────────────────────────────────────────── */

export function MatchDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const cash = account?.kind === 'cash';
  return (
    <Modal size="md" open={account != null} onClose={onClose} title={cash ? 'Count the cash' : 'Match with bank'} description={cash ? 'Check the cash box against what the software shows.' : 'Check this balance against your bank app or passbook.'}>
      {account && <MatchForm key={account.id} account={account} onDone={onClose} />}
    </Modal>
  );
}

function MatchForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const match = useMatchBalance();
  const cash = account.kind === 'cash';
  const [requestId] = useState(() => crypto.randomUUID());
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const actualPaise = readSigned(actual);
  const difference = actualPaise == null ? null : actualPaise - account.balancePaise;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (actualPaise == null) return setError(cash ? 'Enter the cash you counted' : 'Enter the balance your bank shows');
    setError('');
    try {
      const result = await match.mutateAsync({ accountId: account.id, requestId, actualBalancePaise: actualPaise, note: note.trim() });
      toast(result.matched ? `${account.name} matches. Nothing to correct.` : `${account.name} corrected to ${formatPaise(result.balancePaise)}`);
      onDone();
    } catch (failure) {
      toast(messageOf(failure), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="rounded-xl bg-gray-50 px-4 py-3">
        <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">The software shows</p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{formatPaise(account.balancePaise)}</p>
      </div>
      <FormField label={cash ? 'Cash you counted' : 'Balance your bank shows now'} htmlFor="match-actual" error={error}>
        <AmountInput id="match-actual" value={actual} onChange={setActual} autoFocus large allowNegative={!cash} />
      </FormField>
      {difference != null &&
        (difference === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            It matches. Nothing needs correcting.
          </p>
        ) : (
          <>
            <p className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-xs font-medium text-orange-800">
              {cash ? 'The cash box has' : 'The bank has'} <strong className="font-mono">{formatPaise(Math.abs(difference))}</strong> {difference > 0 ? 'more' : 'less'} than the software. Saving adds one correction line of{' '}
              <strong className="font-mono">
                {difference > 0 ? '+' : '−'}
                {formatPaise(Math.abs(difference))}
              </strong>{' '}
              so the two agree. First check whether an expense or deposit simply hasn’t been entered yet.
            </p>
            <FormField label="Reason (optional)" htmlFor="match-note">
              <input id="match-note" className={`${controlClass} w-full`} maxLength={120} placeholder="e.g. Bank SMS charges" value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
          </>
        ))}
      <Actions onCancel={onDone} saving={match.isPending} label={difference ? 'Correct the balance' : 'Check'} />
    </form>
  );
}

/* ── Cancel an entry ──────────────────────────────────────────────────── */

export function ReasonDialog({ open, title, children, saving, onSubmit, onClose }: { open: boolean; title: string; children: ReactNode; saving: boolean; onSubmit: (reason: string) => void; onClose: () => void }) {
  return (
    <Modal size="md" open={open} onClose={onClose} title={title}>
      {open && <ReasonForm saving={saving} onSubmit={onSubmit} onClose={onClose}>{children}</ReasonForm>}
    </Modal>
  );
}

function ReasonForm({ children, saving, onSubmit, onClose }: { children: ReactNode; saving: boolean; onSubmit: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 3) return setError('Say why this is being cancelled');
        onSubmit(reason.trim());
      }}
    >
      {children}
      <FormField label="Why is this being cancelled?" htmlFor="cancel-reason" error={error} hint="Nothing is deleted. A matching line is added that cancels it out, and both stay in the statement.">
        <input id="cancel-reason" autoFocus className={`${controlClass} w-full`} maxLength={120} placeholder="e.g. Entered twice by mistake" value={reason} onChange={(event) => setReason(event.target.value)} />
      </FormField>
      <Actions onCancel={onClose} saving={saving} label="Cancel this entry" tone="danger" />
    </form>
  );
}

export function CancelEntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const reverse = useReverseEntry();
  return (
    <ReasonDialog
      open={entry != null}
      title="Cancel entry"
      saving={reverse.isPending}
      onClose={onClose}
      onSubmit={async (reason) => {
        if (!entry) return;
        try {
          await reverse.mutateAsync({ id: entry.id, reason });
          toast('Entry cancelled');
          onClose();
        } catch (error) {
          toast(messageOf(error), 'error');
        }
      }}
    >
      {entry && (
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs">
          <p className="font-bold text-neutral-900">{entry.description}</p>
          <p className={clsx('mt-1 font-mono text-base font-bold', entry.amountPaise > 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {entry.amountPaise > 0 ? '+' : '−'}
            {formatPaise(Math.abs(entry.amountPaise))}
          </p>
          {entry.isTransfer && <p className="mt-1 text-gray-500">This is a transfer, so it will be cancelled on both accounts.</p>}
        </div>
      )}
    </ReasonDialog>
  );
}

/* ── Add / edit an account (owner) ────────────────────────────────────── */

export type AccountDialogState = { mode: 'create' } | { mode: 'edit'; account: Account } | null;

export function AccountDialog({ state, today, onClose }: { state: AccountDialogState; today: string; onClose: () => void }) {
  const editing = state?.mode === 'edit' ? state.account : null;
  return (
    <Modal size="md" open={state != null} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add bank account'} description={editing ? undefined : 'For a second bank account you want to track here.'}>
      {state && <AccountForm key={editing?.id ?? 'new'} account={editing} today={today} onDone={onClose} />}
    </Modal>
  );
}

function AccountForm({ account, today, onDone }: { account: Account | null; today: string; onDone: () => void }) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const cash = account?.kind === 'cash';
  const [name, setName] = useState(account?.name ?? '');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [last4, setLast4] = useState(account?.accountLast4 ?? '');
  const [opening, setOpening] = useState(account ? `${account.openingBalancePaise < 0 ? '-' : ''}${paiseToInput(Math.abs(account.openingBalancePaise))}` : '');
  const [openingDate, setOpeningDate] = useState(account?.openingDate ?? today);
  const [receivesOnline, setReceivesOnline] = useState(account?.receivesOnline ?? false);
  const [receivesOffline, setReceivesOffline] = useState(account?.receivesOffline ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = create.isPending || update.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const openingPaise = readSigned(opening || '0');
    const problems: Record<string, string> = {};
    if (name.trim().length < 2) problems.name = 'Give the account a name';
    if (last4 && !/^\d{4}$/.test(last4)) problems.accountLast4 = 'Enter the last 4 digits';
    if (openingPaise == null) problems.openingBalancePaise = 'Enter a valid amount, like 25000 or 25000.50';
    setErrors(problems);
    if (Object.keys(problems).length || openingPaise == null) return;
    const body = { name: name.trim(), bankName: bankName.trim(), accountLast4: last4, openingBalancePaise: openingPaise, openingDate };
    try {
      if (account) {
        await update.mutateAsync({
          id: account.id,
          ...body,
          ...(receivesOnline && !account.receivesOnline ? { receivesOnline: true as const } : {}),
          ...(receivesOffline && !account.receivesOffline ? { receivesOffline: true as const } : {}),
        });
        toast(`${body.name} updated`);
      } else {
        await create.mutateAsync(body);
        toast(`${body.name} added`);
      }
      onDone();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(messageOf(error), 'error');
    }
  }

  async function setActive(isActive: boolean) {
    if (!account) return;
    try {
      await update.mutateAsync({ id: account.id, isActive });
      toast(isActive ? `${account.name} reopened` : `${account.name} closed`);
      onDone();
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="Account name" htmlFor="account-name" error={errors.name}>
        <input id="account-name" autoFocus={!account} className={`${controlClass} w-full`} maxLength={80} placeholder="e.g. HDFC Current Account" value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      {!cash && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Bank (optional)" htmlFor="account-bank">
            <input id="account-bank" className={`${controlClass} w-full`} maxLength={80} placeholder="e.g. HDFC Bank" value={bankName} onChange={(event) => setBankName(event.target.value)} />
          </FormField>
          <FormField label="Last 4 digits (optional)" htmlFor="account-last4" error={errors.accountLast4}>
            <input id="account-last4" inputMode="numeric" className={`${controlClass} w-full font-mono`} maxLength={4} placeholder="1234" value={last4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, ''))} />
          </FormField>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Opening balance" htmlFor="account-opening" error={errors.openingBalancePaise}>
          <AmountInput id="account-opening" value={opening} onChange={setOpening} allowNegative={!cash} />
        </FormField>
        <FormField label="As on" htmlFor="account-opening-date" error={errors.openingDate}>
          <DatePicker id="account-opening-date" className="w-full" value={openingDate} onChange={setOpeningDate} max={today} />
        </FormField>
      </div>
      <p className="text-xs text-gray-500">
        {cash ? 'The cash you had in hand on that date.' : 'What the bank showed on that date.'} Everything recorded after it is added to or taken from this amount.
      </p>
      {account && !cash && account.isActive && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-3">
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>
              <span className="font-bold text-neutral-900">Website payments arrive here</span>
              <span className="block text-gray-500">Razorpay payouts are added to this account.</span>
            </span>
            <Switch label="Website payments arrive here" checked={receivesOnline} disabled={account.receivesOnline} onChange={setReceivesOnline} />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>
              <span className="font-bold text-neutral-900">Offline UPI and card payments arrive here</span>
              <span className="block text-gray-500">Cash always goes to Cash in hand.</span>
            </span>
            <Switch label="Offline UPI and card payments arrive here" checked={receivesOffline} disabled={account.receivesOffline} onChange={setReceivesOffline} />
          </label>
        </div>
      )}
      {account && !cash && !account.receivesOnline && !account.receivesOffline && (
        <div>
          <button
            type="button"
            // An account can only be closed once it is empty, or its money would drop out of the total.
            disabled={account.isActive && account.balancePaise !== 0}
            onClick={() => void setActive(!account.isActive)}
            className="text-xs font-bold text-rose-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
          >
            {account.isActive ? 'Close this account' : 'Reopen this account'}
          </button>
          {account.isActive && account.balancePaise !== 0 && <p className="mt-1 text-xs text-gray-500">To close it, first transfer its {formatPaise(account.balancePaise)} to another account so the balance is zero.</p>}
        </div>
      )}
      <Actions onCancel={onDone} saving={saving} label={account ? 'Save changes' : 'Add account'} />
    </form>
  );
}
