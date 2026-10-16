import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { controlClass, FormField, Select } from '@/components/ui/controls';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { fieldErrorsOf, messageOf } from '@/lib/errors';
import { formatPaise, paiseToInput } from '@/lib/money';
import { monthName, useCreateEmployee, usePaySalary, useUpdateEmployee, type Employee, type PayAccount, type SalaryKind } from './api';
import { AmountInput, earliestDateHint, readAmount } from './forms';

/* ── Add / edit an employee ───────────────────────────────────────────── */

export type EmployeeDialogState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

export function EmployeeDialog({ state, onClose }: { state: EmployeeDialogState; onClose: () => void }) {
  const employee = state?.mode === 'edit' ? state.employee : null;
  return (
    <Modal size="md" open={state != null} onClose={onClose} title={employee ? `Edit ${employee.name}` : 'Add employee'}>
      {state && <EmployeeForm key={employee?.id ?? 'new'} employee={employee} onDone={onClose} />}
    </Modal>
  );
}

function EmployeeForm({ employee, onDone }: { employee: Employee | null; onDone: () => void }) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [name, setName] = useState(employee?.name ?? '');
  const [role, setRole] = useState(employee?.role ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [salary, setSalary] = useState(employee ? paiseToInput(employee.monthlySalaryPaise) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = readAmount(salary);
    const problems: Record<string, string> = {};
    if (name.trim().length < 2) problems.name = 'Enter the employee’s name';
    if ('error' in parsed) problems.monthlySalaryPaise = parsed.error;
    setErrors(problems);
    if (Object.keys(problems).length || 'error' in parsed) return;
    const body = { name: name.trim(), role: role.trim(), phone: phone.trim(), monthlySalaryPaise: parsed.paise };
    try {
      if (employee) await update.mutateAsync({ id: employee.id, ...body });
      else await create.mutateAsync(body);
      toast(employee ? `${body.name} updated` : `${body.name} added`);
      onDone();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(messageOf(error), 'error');
    }
  }

  async function setActive(isActive: boolean) {
    if (!employee) return;
    try {
      await update.mutateAsync({ id: employee.id, isActive });
      toast(isActive ? `${employee.name} is back on the payroll` : `${employee.name} removed from the payroll`);
      onDone();
    } catch (error) {
      toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField label="Name" htmlFor="employee-name" error={errors.name}>
        <input id="employee-name" autoFocus={!employee} className={`${controlClass} w-full`} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Job (optional)" htmlFor="employee-role">
          <input id="employee-role" className={`${controlClass} w-full`} maxLength={80} placeholder="e.g. Packing" value={role} onChange={(event) => setRole(event.target.value)} />
        </FormField>
        <FormField label="Phone (optional)" htmlFor="employee-phone">
          <input id="employee-phone" inputMode="tel" className={`${controlClass} w-full font-mono`} maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </FormField>
      </div>
      <FormField label="Monthly salary" htmlFor="employee-salary" error={errors.monthlySalaryPaise} hint="Filled in for you each month. You can change the amount when paying.">
        <AmountInput id="employee-salary" value={salary} onChange={setSalary} />
      </FormField>
      {employee && (
        <button type="button" onClick={() => void setActive(!employee.isActive)} className="text-xs font-bold text-rose-700 underline underline-offset-2">
          {employee.isActive ? 'Remove from payroll (they have left)' : 'Put back on the payroll'}
        </button>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {employee ? 'Save changes' : 'Add employee'}
        </Button>
      </div>
    </form>
  );
}

/* ── Pay salary / advance / bonus ─────────────────────────────────────── */

export type PayDialogState = { kind: SalaryKind; employee: Employee } | null;

const PAY_TITLE: Record<SalaryKind, string> = { salary: 'Pay salary', advance: 'Give advance', bonus: 'Give bonus' };
const PAY_HELP: Record<SalaryKind, string> = {
  salary: 'The month’s pay, taken from the account you choose.',
  advance: 'Money given early. You take it back from later salaries.',
  bonus: 'Extra pay on top of salary. It is never taken back.',
};

export function PayDialog({ state, month, accounts, today, onClose }: { state: PayDialogState; month: string; accounts: PayAccount[]; today: string; onClose: () => void }) {
  return (
    <Modal size="md" open={state != null} onClose={onClose} title={state ? `${PAY_TITLE[state.kind]} · ${state.employee.name}` : ''} description={state ? PAY_HELP[state.kind] : undefined}>
      {state && <PayForm key={`${state.kind}-${state.employee.id}-${month}`} state={state} month={month} accounts={accounts} today={today} onDone={onClose} />}
    </Modal>
  );
}

function PayForm({ state, month, accounts, today, onDone }: { state: NonNullable<PayDialogState>; month: string; accounts: PayAccount[]; today: string; onDone: () => void }) {
  const pay = usePaySalary();
  const { kind, employee } = state;
  const active = accounts.filter((a) => a.isActive);
  const isSalary = kind === 'salary';
  const outstanding = employee.advanceOutstandingPaise;

  const [requestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(isSalary ? paiseToInput(employee.monthlySalaryPaise) : '');
  const [deduct, setDeduct] = useState(isSalary && outstanding > 0 ? paiseToInput(Math.min(outstanding, employee.monthlySalaryPaise)) : '');
  const [accountId, setAccountId] = useState<number | null>(active.find((a) => a.kind === 'bank')?.id ?? active[0]?.id ?? null);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const parsed = readAmount(amount);
  const parsedDeduct = isSalary && outstanding > 0 ? readAmount(deduct || '0', { allowZero: true }) : { paise: 0 };
  const gross = 'paise' in parsed ? parsed.paise : 0;
  const deducted = 'paise' in parsedDeduct ? parsedDeduct.paise : 0;
  const toPay = Math.max(0, gross - deducted);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    if ('error' in parsed) problems.amountPaise = parsed.error;
    if ('error' in parsedDeduct) problems.advanceDeductedPaise = parsedDeduct.error;
    else if (deducted > outstanding) problems.advanceDeductedPaise = `Only ${formatPaise(outstanding)} is left to take back`;
    else if (deducted > gross) problems.advanceDeductedPaise = 'Can’t be more than the salary';
    if (!account) problems.accountId = 'Choose the account to pay from';
    // Staff who can't see balances are still protected: the server refuses to take more cash than there is.
    else if (account.kind === 'cash' && account.balancePaise !== null && toPay > account.balancePaise) problems.accountId = `Cash in hand is only ${formatPaise(account.balancePaise)}`;
    setErrors(problems);
    if (Object.keys(problems).length || !account || 'error' in parsed) return;
    setConfirming(true);
  }

  async function payNow() {
    setConfirming(false);
    if (!account || 'error' in parsed) return;
    try {
      await pay.mutateAsync({ requestId, employeeId: employee.id, kind, ...(isSalary ? { periodMonth: month, advanceDeductedPaise: deducted } : {}), amountPaise: parsed.paise, accountId: account.id, paidOn, note: note.trim() });
      toast(isSalary ? `${employee.name}’s salary for ${monthName(month)} paid: ${formatPaise(toPay)}` : `${formatPaise(parsed.paise)} ${kind} given to ${employee.name}`);
      onDone();
    } catch (error) {
      const fields = fieldErrorsOf(error);
      if (Object.keys(fields).length) setErrors(fields);
      else toast(messageOf(error), 'error');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {isSalary && (
        <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-600">
          Salary for <strong className="font-bold text-neutral-900">{monthName(month)}</strong>
        </p>
      )}
      <FormField label={isSalary ? 'Salary for the month' : kind === 'advance' ? 'Advance amount' : 'Bonus amount'} htmlFor="pay-amount" error={errors.amountPaise}>
        <AmountInput id="pay-amount" value={amount} onChange={setAmount} autoFocus={!isSalary} large />
      </FormField>
      {isSalary && outstanding > 0 && (
        <FormField label="Advance to take back now" htmlFor="pay-deduct" error={errors.advanceDeductedPaise} hint={`${employee.name} still owes ${formatPaise(outstanding)} from advances. Enter 0 to leave it for a later month.`}>
          <AmountInput id="pay-deduct" value={deduct} onChange={setDeduct} />
        </FormField>
      )}
      {!isSalary && kind === 'advance' && outstanding > 0 && <p className="text-xs text-gray-500">Already owes {formatPaise(outstanding)} from earlier advances.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Pay from" htmlFor="pay-account" error={errors.accountId}>
          <Select id="pay-account" className="w-full" value={accountId ?? ''} onChange={(event) => setAccountId(Number(event.target.value))}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.balancePaise === null ? a.name : `${a.name} · ${formatPaise(a.balancePaise)}`}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Paid on" htmlFor="pay-date" error={errors.paidOn} hint={earliestDateHint(account)}>
          <DatePicker id="pay-date" className="w-full" value={paidOn} onChange={setPaidOn} max={today} min={account?.openingDate} />
        </FormField>
      </div>
      <FormField label="Note (optional)" htmlFor="pay-note">
        <input id="pay-note" className={`${controlClass} w-full`} maxLength={120} placeholder={kind === 'bonus' ? 'e.g. Onam bonus' : kind === 'advance' ? 'e.g. Medical emergency' : ''} value={note} onChange={(event) => setNote(event.target.value)} />
      </FormField>

      <div className="rounded-xl border border-gray-200 px-4 py-3">
        {isSalary && deducted > 0 && (
          <dl className="mb-2 space-y-1 border-b border-gray-100 pb-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-600">Salary</dt>
              <dd className="font-mono font-bold tabular-nums">{formatPaise(gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Advance taken back</dt>
              <dd className="font-mono font-bold text-rose-600 tabular-nums">−{formatPaise(deducted)}</dd>
            </div>
          </dl>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{account ? `Leaves ${account.name}` : 'To pay now'}</p>
          <p className="font-mono text-xl font-bold tabular-nums">{formatPaise(toPay)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={pay.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={pay.isPending}>
          {isSalary ? `Pay ${formatPaise(toPay)}` : PAY_TITLE[kind]}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={isSalary ? `Pay ${formatPaise(toPay)} to ${employee.name}?` : `Give ${formatPaise(toPay)} ${kind} to ${employee.name}?`}
        tone="primary"
        confirmLabel={isSalary ? 'Yes, pay' : `Yes, give ${kind}`}
        loading={pay.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void payNow()}
        message={
          account && (
            <>
              {isSalary && <p className="text-fg">Salary for {monthName(month)}{deducted > 0 ? `, after taking back ${formatPaise(deducted)} of advance` : ''}.</p>}
              {account.balancePaise === null ? (
                <p className="mt-2 font-medium text-fg">Paid from {account.name}.</p>
              ) : (
                <p className="mt-2 font-medium text-fg">
                  {account.name}: {formatPaise(account.balancePaise)} → <span className={account.balancePaise - toPay < 0 ? 'text-rose-600' : undefined}>{formatPaise(account.balancePaise - toPay)}</span>
                </p>
              )}
              <p className="mt-2">{isSalary ? 'Each month can be paid once.' : 'This is recorded straight away.'} To undo it later you have to cancel the payment with a reason.</p>
            </>
          )
        }
      />
    </form>
  );
}
