// Döküm sahası Excel eşleşmesi (dumpStatus / dumpNetKg / dumpFee / dumpPlate) — yeni API alanları, eski API döndürmez.
// Alan yoksa bütün yardımcılar null döner → ekran bugünkü gibi görünür.

export type DumpStatus = 'matched' | 'plateMismatch' | 'waiting';

type DumpFields = {
  dumpStatus?: string | null;
  dumpNetKg?: number | null;
  dumpFee?: number | null;
  dumpPlate?: string | null;
};

const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n);

/** Bilinen bir durum değilse null (alan yok / beklenmeyen değer → hiçbir şey gösterme). */
export const getDumpStatus = (h?: DumpFields | null): DumpStatus | null => {
  const s = String(h?.dumpStatus ?? '')
    .trim()
    .toLowerCase();
  if (s === 'matched') return 'matched';
  if (s === 'platemismatch') return 'plateMismatch';
  if (s === 'waiting') return 'waiting';
  return null;
};

/** "26,43 t · 4.376,81 ₺" — eksik kısım atlanır; ikisi de yoksa ''. */
export const formatDumpAmounts = (h?: DumpFields | null): string => {
  const parts: string[] = [];
  const netKg = h?.dumpNetKg;
  const fee = h?.dumpFee;
  if (isNum(netKg)) parts.push(`${fmt2(netKg / 1000)} t`);
  if (isNum(fee)) parts.push(`${fmt2(fee)} ₺`);
  return parts.join(' · ');
};

export type DumpLine = { status: DumpStatus; text: string; amountsText: string };

/**
 * Sefer satırı için döküm özeti.
 * matched → text "Döküm: 26,43 t · 4.376,81 ₺"
 * plateMismatch → text "⚠ Farklı plaka döküme girdi: 34ABC123", amountsText "Döküm: ..."
 * waiting → text "Döküm bekleniyor…"
 */
export const formatDumpLine = (h?: DumpFields | null): DumpLine | null => {
  const status = getDumpStatus(h);
  if (!status) return null;
  const amounts = formatDumpAmounts(h);
  if (status === 'waiting') return { status, text: 'Döküm bekleniyor…', amountsText: '' };
  if (status === 'matched') return { status, text: amounts ? `Döküm: ${amounts}` : 'Döküm eşleşti', amountsText: '' };
  const plate = String(h?.dumpPlate ?? '').trim();
  return { status, text: `⚠ Farklı plaka döküme girdi${plate ? `: ${plate}` : ''}`, amountsText: amounts ? `Döküm: ${amounts}` : '' };
};

/** Ekrandaki fiş modalı satır değeri — sadece matched / plateMismatch; aksi halde null. */
export const formatDumpReceiptValue = (h?: DumpFields | null): string | null => {
  const status = getDumpStatus(h);
  if (status !== 'matched' && status !== 'plateMismatch') return null;
  const amounts = formatDumpAmounts(h) || 'Eşleşti';
  if (status === 'plateMismatch') {
    const plate = String(h?.dumpPlate ?? '').trim();
    return `${amounts} (Farklı plaka${plate ? `: ${plate}` : ''})`;
  }
  return amounts;
};
