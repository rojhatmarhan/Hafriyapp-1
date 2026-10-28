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

// ── Döküm verisi ekranı (İşlerim → Döküm) yardımcıları — GET /DumpImport/summary, /records

export type DumpSource = '' | 'Kig' | 'Istac'; // '' = tümü
export type DumpMatchStatus = 'matched' | 'plateMismatch' | 'unmatched';

/** API biçim adı → ekranda görünen ad ('Kig' → 'Cebeci', 'Istac' → 'İSTAÇ'); bilinmiyorsa ''. */
export const dumpSourceLabel = (format?: string | null): string => {
  const s = String(format ?? '')
    .trim()
    .toLowerCase();
  if (s === 'kig') return 'Cebeci';
  if (s === 'istac') return 'İSTAÇ';
  return '';
};

/** Kaynak seçici başlığı: "Cebeci Dökümü Özet", "İSTAÇ Dökümü Özet", "Tüm Dökümler Özet". */
export const dumpSourceTitle = (source: DumpSource): string => {
  const label = dumpSourceLabel(source);
  return label ? `${label} Dökümü Özet` : 'Tüm Dökümler Özet';
};

/** Kayıt eşleşme durumu; bilinmeyen/boş değer → 'unmatched'. */
export const getDumpMatchStatus = (status?: string | null): DumpMatchStatus => {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  if (s === 'matched') return 'matched';
  if (s === 'platemismatch') return 'plateMismatch';
  return 'unmatched';
};

/** Satır sol şerit rengi: eşleşen yeşil, farklı plaka kırmızı, eşleşmeyen gri. */
export const dumpStatusColor = (status: DumpMatchStatus): string => (status === 'matched' ? '#2E7D32' : status === 'plateMismatch' ? '#C62828' : '#BDBDBD');

const toNum = (n: unknown): number | null => {
  if (typeof n === 'number') return isFinite(n) ? n : null;
  if (typeof n === 'string' && n.trim() !== '') {
    const v = Number(n);
    return isFinite(v) ? v : null;
  }
  return null;
};

/** "4.376,81₺" (tr-TR, 2 ondalık); sayı değilse "0,00₺". */
export const formatTL = (n: unknown): string => `${fmt2(toNum(n) ?? 0)}₺`;

/** "28.390 kg" (tr-TR, ondalıksız); sayı değilse "0 kg". */
export const formatKg = (n: unknown): string => `${Math.round(toNum(n) ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} kg`;

/**
 * İş kartındaki döküm özeti (API iş listesi: dumpAvgBrutKg, dumpTotalFee, dumpMissingCount).
 * Alan yoksa (eski API / döküm fişi girilmiş sefer yok) null → kartta hiçbir şey gösterilmez.
 */
export const formatJobDumpSummary = (job?: { dumpAvgBrutKg?: number | null; dumpTotalFee?: number | null; dumpMissingCount?: number | null } | null): { avg: string | null; total: string; missing: string | null } | null => {
  const total = toNum(job?.dumpTotalFee);
  if (total === null) return null;
  const avg = toNum(job?.dumpAvgBrutKg);
  const missing = toNum(job?.dumpMissingCount) ?? 0;
  return {
    avg: avg === null ? null : `${(avg / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Ton`,
    total: formatTL(total),
    missing: missing > 0 ? `(${missing} seferin verisi alınamadı)` : null,
  };
};

/** Net kg → ton, "26,43"; sayı değilse "-". */
export const formatTonnes = (netKg: unknown): string => {
  const v = toNum(netKg);
  return v === null ? '-' : fmt2(v / 1000);
};

/** Ücret "4.376,81" (para birimi yok); sayı değilse "-". */
export const formatFee = (fee: unknown): string => {
  const v = toNum(fee);
  return v === null ? '-' : fmt2(v);
};

/**
 * İşlem tarihi → { date: "dd.MM.yyyy", time: "HH:mm" }.
 * Saat dilimi yoksa (Excel'den gelen yerel saat) olduğu gibi okunur; "Z"/ofset varsa Türkiye saatine (UTC+3) çevrilir.
 */
export const formatDumpDateTime = (value?: string | null): { date: string; time: string } => {
  const raw = String(value ?? '').trim();
  if (!raw) return { date: '-', time: '' };
  const local = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?(?::\d{2}(?:\.\d+)?)?$/);
  if (local) return { date: `${local[3]}.${local[2]}.${local[1]}`, time: local[4] ? `${local[4]}:${local[5]}` : '' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: raw, time: '' };
  const tr = new Date(d.getTime() + 3 * 60 * 60000);
  const p = (x: number) => String(x).padStart(2, '0');
  return { date: `${p(tr.getUTCDate())}.${p(tr.getUTCMonth() + 1)}.${tr.getUTCFullYear()}`, time: `${p(tr.getUTCHours())}:${p(tr.getUTCMinutes())}` };
};

export type DumpQueryParams = {
  companyId: string;
  source?: DumpSource;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  jobSiteId?: string | null;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

/** Sorgu metni (boş alanlar atlanır): "companyId=..&source=Kig&startDate=2026-10-01". */
export const buildDumpQuery = (p: DumpQueryParams): string => {
  const pairs: [string, string | number | undefined | null][] = [
    ['companyId', p.companyId],
    ['source', p.source],
    ['startDate', p.startDate],
    ['endDate', p.endDate],
    ['jobSiteId', p.jobSiteId],
    ['search', p.search?.trim()],
    ['status', p.status],
    ['page', p.page],
    ['pageSize', p.pageSize],
  ];
  return pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
};

// ── Hesapta Kalan / para yatırma yardımcıları

/**
 * Türkçe tutar metni → sayı (2 ondalığa yuvarlanır); geçersiz/boşsa null.
 * "150.000,50" → 150000.5 · "150000,5" → 150000.5 · "150.000" → 150000 · "1.5" → 1.5 · "₺ 2.500" → 2500.
 * Virgül varsa ondalık ayırıcıdır, noktalar binliktir. Virgül yoksa noktalar 3'lü gruplar halindeyse binlik, tek nokta + farklı hane sayısı ise ondalık.
 */
export const parseTurkishAmount = (text: unknown): number | null => {
  let s = String(text ?? '')
    .replace(/[\s ₺]/g, '')
    .replace(/TL$/i, '');
  if (!s) return null;
  if (s.includes(',')) {
    if (s.split(',').length > 2) return null;
    const [intPart, dec] = s.split(',');
    if (intPart.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
    s = `${intPart.replace(/\./g, '')}.${dec}`;
  } else if (s.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (s.split('.').length > 2) return null;
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const v = Number(s);
  if (!isFinite(v)) return null;
  return Math.round(v * 100) / 100;
};

/** "DD.MM.YYYY" gerçek bir takvim günü mü? (31.02 gibi tarihler geçersiz) */
export const isValidDDMMYYYY = (str: string): boolean => {
  const m = String(str ?? '')
    .trim()
    .match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return false;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

/**
 * Para yatırma tarihi "DD.MM.YYYY" → ISO UTC. Türkiye saatiyle öğlen (09:00Z) gönderilir; böylece hangi saat diliminde
 * gösterilirse gösterilsin gün kaymaz. Geçersizse undefined (API bugünü kullanır).
 */
export const depositDateToIso = (str: string): string | undefined => {
  if (!isValidDDMMYYYY(str)) return undefined;
  const [d, m, y] = str.trim().split('.');
  return `${y}-${m}-${d}T09:00:00.000Z`;
};

/** Hesapta Kalan kartı alt yazısı: "Yatırılan 150.000,00₺ · Harcanan 4.376,81₺" */
export const formatBalanceSubtext = (totalDeposits: unknown, totalFees: unknown): string => `Yatırılan ${formatTL(totalDeposits)} · Harcanan ${formatTL(totalFees)}`;
