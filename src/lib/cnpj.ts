// Utilitários de CNPJ — validação pelo algoritmo oficial e formatação.

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D+/g, '');
}

export function formatCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  // Rejeita sequências repetidas (00000000000000, 11111111111111, ...)
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((acc, n, i) => acc + parseInt(n, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(cnpj.slice(0, 12), w1);
  if (d1 !== parseInt(cnpj[12], 10)) return false;
  const d2 = calcDigit(cnpj.slice(0, 13), w2);
  if (d2 !== parseInt(cnpj[13], 10)) return false;
  return true;
}
