/**
 * Restart-aware cycle coverage helpers (دورة جديدة / returning students).
 *
 * When a student restarts their payment cycle (cycleStartDate is set), the
 * months BEFORE the restart are wiped. Their new-cycle payments buy
 * consecutive attendance months ENDING at the most recent payment's month
 * (paymentDate) — NOT starting from the restart month. This matches the
 * academy workflow: a returning student pays again when they come back, and
 * the latest recorded payment (e.g. October) must count for that month, so
 * the student is clean until the following month's due date.
 */

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

/** Build a Date for a year*12+month index using the given cycle day (clamped to month length). */
export function cycleDateForYM(ym: number, cycleDay: number): Date {
  const year = Math.floor(ym / 12);
  const monthIndex = ym % 12;
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(cycleDay, lastDayOfMonth));
}

export interface RestartCyclePayment {
  id?: string;
  remainingAmount: number;
  paymentDate: Date | string | null;
  month: string;
  year: number;
  packMonths: number;
}

/**
 * Find the END of the restarted cycle's coverage queue: the month of the
 * most recent fully-paid payment (by paymentDate, falling back to the
 * payment's month/year field). Returns null when the cycle has no
 * fully-paid payments.
 */
export function getRestartQueueEnd(
  cyclePayments: RestartCyclePayment[]
): { endYM: number; latestPaidId: string } | null {
  let endYM: number | null = null;
  let latestPaidId = '';
  let latestTime = -Infinity;

  for (const p of cyclePayments) {
    if (p.remainingAmount !== 0) continue;
    const d = p.paymentDate
      ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
      : new Date(p.year, Math.max(0, getMonthIndex(p.month)), 1);
    const ym = d.getFullYear() * 12 + d.getMonth();
    if (ym > latestTime || (ym === latestTime && p.id && p.id > latestPaidId)) {
      latestTime = ym;
      endYM = ym;
      latestPaidId = p.id || '';
    }
  }

  return endYM === null ? null : { endYM, latestPaidId };
}

/**
 * Find the latest FULLY-PAID payment (by paymentDate, falling back to the
 * payment's month/year). The result anchors the next due date to the day the
 * student ACTUALLY paid: paying on the 1st means the next due is the 1st of
 * the following month — regardless of the enrollment/restart cycle day.
 */
export function getLatestPaidPayment(
  payments: RestartCyclePayment[]
): { date: Date; packMonths: number; id: string } | null {
  let best: { date: Date; packMonths: number; id: string } | null = null;

  for (const p of payments) {
    if (p.remainingAmount !== 0) continue;
    const d = p.paymentDate
      ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
      : new Date(p.year, Math.max(0, MONTH_ORDER.indexOf(p.month)), 1);
    const id = p.id || '';
    if (
      !best ||
      d.getTime() > best.date.getTime() ||
      (d.getTime() === best.date.getTime() && id > best.id)
    ) {
      best = { date: d, packMonths: p.packMonths || 1, id };
    }
  }

  return best;
}

/**
 * Next due date anchored to a payment: paymentDate + packMonths months, with
 * the payment's DAY preserved (clamped to the target month's length).
 * E.g. paid Oct 1 (pack 1) → due Nov 1; paid May 31 → due Jun 30; 3-month
 * pack paid Oct 1 → due Jan 1.
 */
export function nextDueFromLatestPaid(latest: { date: Date; packMonths: number }): Date {
  const targetYM =
    latest.date.getFullYear() * 12 + latest.date.getMonth() + Math.max(1, latest.packMonths);
  return cycleDateForYM(targetYM, latest.date.getDate());
}
