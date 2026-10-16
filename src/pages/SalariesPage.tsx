import { clsx } from 'clsx';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Gift, HandCoins, IndianRupee, Pencil, Plus, Undo2, UserPlus, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, TableSkeleton } from '@/components/ui/DataState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { toast } from '@/components/ui/Toast';
import { monthName, shiftMonth, usePayroll, useReverseSalary, useSalaryAccounts, useSalaryPayments, type Employee, type SalaryKind, type SalaryPayment } from '@/features/accounts/api';
import { ReasonDialog } from '@/features/accounts/forms';
import { EmployeeDialog, PayDialog, type EmployeeDialogState, type PayDialogState } from '@/features/accounts/salary-forms';
import { useSession } from '@/features/auth/session';
import { formatDay, istToday } from '@/lib/dates';
import { messageOf } from '@/lib/errors';
import { formatPaise } from '@/lib/money';

const KIND_LABEL: Record<SalaryKind, string> = { salary: 'Salary', advance: 'Advance', bonus: 'Bonus' };

function MonthStatus({ employee }: { employee: Employee }) {
  const salary = employee.month.salary;
  if (!salary) {
    return (
      <Badge tone="warning">
        <Clock className="size-3" aria-hidden />
        Not paid
      </Badge>
    );
  }
  return (
    <div>
      <Badge tone="success">
        <CheckCircle2 className="size-3" aria-hidden />
        Paid {formatPaise(salary.paidPaise)}
      </Badge>
      <p className="mt-1 text-[11px] text-gray-500">
        {formatDay(salary.paidOn)}
        {salary.advanceDeductedPaise > 0 && ` · ${formatPaise(salary.advanceDeductedPaise)} advance taken back`}
      </p>
    </div>
  );
}

function RowActions({ employee, onPay, onEdit }: { employee: Employee; onPay: (kind: SalaryKind) => void; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!employee.month.salary && (
        <Button size="sm" onClick={() => onPay('salary')}>
          <IndianRupee className="size-3.5" aria-hidden />
          Pay salary
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => onPay('advance')}>
        <HandCoins className="size-3.5" aria-hidden />
        Advance
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onPay('bonus')}>
        <Gift className="size-3.5" aria-hidden />
        Bonus
      </Button>
      <button type="button" onClick={onEdit} aria-label={`Edit ${employee.name}`} title="Edit" className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-neutral-900">
        <Pencil className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export default function SalariesPage() {
  const { can } = useSession();
  const canManage = can('salaries.manage');
  const thisMonth = istToday().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const payroll = usePayroll(month);
  const payments = useSalaryPayments(month);
  // Accounts to pay from: only needed by those who pay, and without balances unless they may see accounts.
  const payFrom = useSalaryAccounts(canManage);
  const reverse = useReverseSalary();

  const [employeeDialog, setEmployeeDialog] = useState<EmployeeDialogState>(null);
  const [payDialog, setPayDialog] = useState<PayDialogState>(null);
  const [cancelPayment, setCancelPayment] = useState<SalaryPayment | null>(null);

  const accounts = payFrom.data?.accounts ?? [];
  const today = payFrom.data?.today ?? istToday();
  const summary = payroll.data?.summary;
  const people = payroll.data?.items ?? [];
  const active = people.filter((p) => p.isActive);
  const former = people.filter((p) => !p.isActive);

  const addButton = canManage && (
    <Button onClick={() => setEmployeeDialog({ mode: 'create' })}>
      <UserPlus className="size-4" aria-hidden />
      Add employee
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Salaries" description="Pay salaries, advances and bonuses. Each payment is taken from the account you choose." actions={addButton} />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm sm:w-fit sm:justify-start">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="grid size-9 place-items-center rounded-xl text-gray-600 hover:bg-gray-100">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="flex min-w-40 items-center justify-center gap-2 text-sm font-bold text-neutral-900" aria-live="polite">
          <CalendarDays className="size-4 text-gray-400" aria-hidden />
          {monthName(month)}
        </p>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Next month" className="grid size-9 place-items-center rounded-xl text-gray-600 hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatTile label="Salaries paid" value={`${summary.paidCount} of ${summary.employees}`} hint={summary.employees - summary.paidCount > 0 ? `${summary.employees - summary.paidCount} still to pay for ${monthName(month)}` : summary.employees ? 'Everyone is paid' : 'No employees yet'} icon={Users} color={summary.employees && summary.paidCount === summary.employees ? 'emerald' : 'orange'} highlight />
          <StatTile label="Monthly salary bill" value={formatPaise(summary.monthlyBillPaise)} hint="All employees together" icon={IndianRupee} color="blue" />
          <StatTile label="Paid out this month" value={formatPaise(summary.paidOutPaise)} hint="Salaries, advances and bonuses" icon={Wallet} color="purple" />
          <StatTile label="Advances to take back" value={formatPaise(summary.advanceOutstandingPaise)} hint="Owed by employees" icon={HandCoins} color={summary.advanceOutstandingPaise > 0 ? 'rose' : 'gray'} />
        </div>
      )}

      <Panel>
        <PanelHeader title="Employees" description={`Who has been paid for ${monthName(month)}.`} icon={Users} />
        {payroll.isPending ? (
          <TableSkeleton />
        ) : payroll.error ? (
          <ErrorState error={payroll.error} onRetry={() => void payroll.refetch()} />
        ) : active.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet" description="Add the people you pay each month. Their salary is then one tap away." action={canManage ? <Button onClick={() => setEmployeeDialog({ mode: 'create' })}><Plus className="size-4" aria-hidden />Add employee</Button> : undefined} />
        ) : (
          <>
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-subtle">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 text-right font-medium">Monthly salary</th>
                  <th className="px-3 py-3 text-right font-medium">Advance owed</th>
                  <th className="px-3 py-3 font-medium">{monthName(month)}</th>
                  {canManage && <th className="px-5 py-3 font-medium">Pay</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-5 py-3">
                      <p className="font-bold text-neutral-900">{employee.name}</p>
                      {employee.role && <p className="text-[11px] text-gray-500">{employee.role}</p>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">{formatPaise(employee.monthlySalaryPaise)}</td>
                    <td className={clsx('px-3 py-3 text-right font-mono font-bold tabular-nums', employee.advanceOutstandingPaise > 0 ? 'text-rose-600' : 'text-gray-400')}>{employee.advanceOutstandingPaise > 0 ? formatPaise(employee.advanceOutstandingPaise) : '—'}</td>
                    <td className="px-3 py-3">
                      <MonthStatus employee={employee} />
                      {(employee.month.advancePaise > 0 || employee.month.bonusPaise > 0) && (
                        <p className="mt-1 text-[11px] text-gray-500">{[employee.month.advancePaise > 0 && `Advance ${formatPaise(employee.month.advancePaise)}`, employee.month.bonusPaise > 0 && `Bonus ${formatPaise(employee.month.bonusPaise)}`].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3">
                        <RowActions employee={employee} onPay={(kind) => setPayDialog({ kind, employee })} onEdit={() => setEmployeeDialog({ mode: 'edit', employee })} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border lg:hidden">
              {active.map((employee) => (
                <li key={employee.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900">{employee.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {employee.role ? `${employee.role} · ` : ''}
                        <span className="font-mono">{formatPaise(employee.monthlySalaryPaise)}</span> a month
                      </p>
                    </div>
                    <MonthStatus employee={employee} />
                  </div>
                  {employee.advanceOutstandingPaise > 0 && (
                    <p className="text-xs text-rose-700">
                      Owes <span className="font-mono font-bold">{formatPaise(employee.advanceOutstandingPaise)}</span> from advances
                    </p>
                  )}
                  {canManage && <RowActions employee={employee} onPay={(kind) => setPayDialog({ kind, employee })} onEdit={() => setEmployeeDialog({ mode: 'edit', employee })} />}
                </li>
              ))}
            </ul>
          </>
        )}
        {former.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
            <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">No longer on the payroll</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {former.map((employee) => (
                <li key={employee.id}>
                  <button type="button" disabled={!canManage} onClick={() => setEmployeeDialog({ mode: 'edit', employee })} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:pointer-events-none">
                    {employee.name}
                    {employee.advanceOutstandingPaise > 0 && <span className="ml-1.5 font-mono text-rose-600">owes {formatPaise(employee.advanceOutstandingPaise)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={`Payments in ${monthName(month)}`} description="Salaries for this month, and advances and bonuses given in it." icon={Wallet} />
        {payments.isPending ? (
          <TableSkeleton rows={3} />
        ) : payments.error ? (
          <ErrorState error={payments.error} onRetry={() => void payments.refetch()} />
        ) : payments.data.items.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-gray-500">No payments recorded for this month yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.data.items.map((payment) => {
              const reversed = payment.status === 'reversed';
              return (
                <li key={payment.id} className={clsx('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5', reversed && 'bg-gray-50/60')}>
                  <div className="min-w-0">
                    <p className={clsx('text-sm font-bold text-neutral-900', reversed && 'line-through decoration-gray-400')}>
                      {payment.employeeName} · {KIND_LABEL[payment.kind]}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatDay(payment.paidOn)} · from {payment.accountName}
                      {payment.advanceDeductedPaise > 0 && ` · ${formatPaise(payment.advanceDeductedPaise)} advance taken back`}
                      {payment.note && ` · ${payment.note}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {reversed && <Badge tone="danger">Cancelled</Badge>}
                    <span className={clsx('font-mono text-sm font-bold tabular-nums', reversed ? 'text-gray-400' : 'text-neutral-900')}>{formatPaise(payment.paidPaise)}</span>
                    {canManage && !reversed && (
                      <button type="button" onClick={() => setCancelPayment(payment)} aria-label={`Cancel ${KIND_LABEL[payment.kind].toLowerCase()} payment to ${payment.employeeName}`} title="Cancel this payment" className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                        <Undo2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <EmployeeDialog state={employeeDialog} onClose={() => setEmployeeDialog(null)} />
      <PayDialog state={payDialog} month={month} accounts={accounts} today={today} onClose={() => setPayDialog(null)} />
      <ReasonDialog
        open={cancelPayment != null}
        title="Cancel payment"
        saving={reverse.isPending}
        onClose={() => setCancelPayment(null)}
        onSubmit={async (reason) => {
          if (!cancelPayment) return;
          try {
            await reverse.mutateAsync({ id: cancelPayment.id, reason });
            toast('Payment cancelled. The money is back in the account.');
            setCancelPayment(null);
          } catch (error) {
            toast(messageOf(error), 'error');
          }
        }}
      >
        {cancelPayment && (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs">
            <p className="font-bold text-neutral-900">
              {cancelPayment.employeeName} · {KIND_LABEL[cancelPayment.kind]}
            </p>
            <p className="mt-1 font-mono text-base font-bold">{formatPaise(cancelPayment.paidPaise)}</p>
            <p className="mt-1 text-gray-500">The money returns to {cancelPayment.accountName}.</p>
          </div>
        )}
      </ReasonDialog>
    </div>
  );
}
