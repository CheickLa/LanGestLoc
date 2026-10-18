import { firstOfMonth } from '@/common/months';

export interface ReceiptRow {
  from: string;
  to: string | null;
  detail: string | null;
  total: number;
}

export function formatMonth(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
}

function formatAmount(n: number): string {
  return `${groupDigits(n)} GNF`;
}

export function groupReceiptLines(
  lines: { month: Date; amount: number }[],
): ReceiptRow[] {
  const sorted = [...lines].sort(
    (a, b) => a.month.getTime() - b.month.getTime(),
  );
  const runs: { month: Date; amount: number }[][] = [];
  for (const line of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (
      run &&
      last.amount === line.amount &&
      firstOfMonth(last.month, 1).getTime() === line.month.getTime()
    ) {
      run.push(line);
    } else {
      runs.push([line]);
    }
  }
  return runs.map((run) => {
    const first = run[0];
    const last = run[run.length - 1];
    const total = run.reduce((sum, l) => sum + l.amount, 0);
    if (run.length === 1) {
      return { from: formatMonth(first.month), to: null, detail: null, total };
    }
    return {
      from: formatMonth(first.month),
      to: formatMonth(last.month),
      detail: `${run.length} mois × ${formatAmount(first.amount)}`,
      total,
    };
  });
}
