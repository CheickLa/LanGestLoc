const ONES = [
  '',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante'];

// `plural` : fin du nombre ou avant million(s)/milliard(s) (quatre-vingts, cents).
function belowHundred(n: number, plural: boolean): string {
  if (n < 17) return ONES[n];
  if (n < 20) return `dix-${ONES[n - 10]}`;
  const [head, rest]: [string, number] =
    n >= 80
      ? ['quatre-vingt', n - 80]
      : n >= 60
        ? ['soixante', n - 60]
        : [TENS[Math.floor(n / 10)], n % 10];
  if (rest === 0) return head === 'quatre-vingt' && plural ? `${head}s` : head;
  const et = head !== 'quatre-vingt' && (rest === 1 || rest === 11);
  return `${head}${et ? ' et ' : '-'}${belowHundred(rest, false)}`;
}

function belowThousand(n: number, plural: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds === 1) parts.push('cent');
  else if (hundreds > 1) {
    parts.push(`${ONES[hundreds]} cent${rest === 0 && plural ? 's' : ''}`);
  }
  if (rest > 0) parts.push(belowHundred(rest, plural));
  return parts.join(' ');
}

function scale(n: number, name: string): string {
  return n === 0 ? '' : `${belowThousand(n, true)} ${name}${n > 1 ? 's' : ''}`;
}

function thousands(n: number): string {
  if (n === 0) return '';
  return n === 1 ? 'mille' : `${belowThousand(n, false)} mille`;
}

export function amountInWords(amount: number): string {
  const words = [
    scale(Math.floor(amount / 1_000_000_000), 'milliard'),
    scale(Math.floor(amount / 1_000_000) % 1000, 'million'),
    thousands(Math.floor(amount / 1000) % 1000),
    belowThousand(amount % 1000, true),
  ]
    .filter(Boolean)
    .join(' ');
  const particle = amount % 1_000_000 === 0 ? ' de' : '';
  return `${words}${particle} ${amount === 1 ? 'franc guinéen' : 'francs guinéens'}`;
}
