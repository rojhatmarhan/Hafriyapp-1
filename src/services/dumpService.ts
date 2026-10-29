import { api, API_BASE_URL } from './api';
import { buildDumpQuery, DumpQueryParams, DumpSource, formatDumpDateTime } from '../utils/dumpFormat';

// ── Döküm sahası verileri (İşlerim → Döküm). Yeni API uçları: eski API'de 404 döner → ekran "sunucu güncellemesi gerekiyor" der.

export type DumpSummary = {
  recordCount: number;
  totalNetKg: number;
  totalFee: number;
  averageNetKg: number;
  matchedCount: number;
  plateMismatchCount: number;
  unmatchedCount: number;
  // Hesapta Kalan (yeni API alanları; eski API döndürmez → balanceSupported=false, kart gizlenir)
  balanceSupported: boolean;
  hasDeposits: boolean;
  totalDeposits: number;
  totalFeesAllTime: number;
  balance: number; // yatırılan − tüm döküm ücretleri; eksi olabilir. Tarih/arama/iş filtresinden bağımsız, sadece kaynağa bağlı.
};

export type DumpDeposit = {
  id: string;
  companyId?: string | null;
  sourceFormat?: string | null; // 'Kig' | 'Istac'
  sourceName?: string | null; // 'Cebeci' | 'İSTAÇ'
  amount: number;
  depositDate?: string | null; // ISO UTC
  note?: string | null;
  createdByName?: string | null;
  createdDate?: string | null;
};

export type NewDumpDeposit = {
  companyId: string;
  source: 'Kig' | 'Istac';
  amount: number;
  depositDate?: string; // ISO
  note?: string;
};

export type DumpRecord = {
  id: string;
  dumpImportId?: string | null;
  sourceFormat?: string | null; // 'Kig' | 'Istac' | 'Unknown'
  etiketNo?: string | null;
  kartKodu?: string | null;
  fisNo?: string | null;
  plateNumber?: string | null;
  islemTarihi?: string | null;
  netKg?: number | null;
  fisBedeli?: number | null;
  matchStatus?: string | null; // 'matched' | 'plateMismatch' | 'unmatched'
  haulId?: string | null;
  haulPlateNumber?: string | null;
  haulSerialNumber?: string | null;
  haulTimeOfHaul?: string | null;
  jobSiteId?: string | null;
  jobSiteName?: string | null;
  // Detay alanları (satıra dokununca açılır; eski API döndürmezse ilgili satır gizlenir)
  kabulBelgesiNo?: string | null;
  brutKg?: number | null;
  daraKg?: number | null;
  cikisTarihi?: string | null;
  yukTipi?: string | null;
  ats?: string | null;
  operator?: string | null;
  sourceSite?: string | null;
};

export type DumpRecordPage = {
  records: DumpRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);

// Result<T> = { isSuccess, data, errors } — bazı eski uçlar data'yı doğrudan döndürebilir
const unwrap = (body: any) => (body && typeof body === 'object' && 'data' in body ? body.data : body);

export const getDumpSummary = async (params: DumpQueryParams): Promise<DumpSummary> => {
  const res = await api.get(`/DumpImport/summary?${buildDumpQuery({ ...params, page: undefined, pageSize: undefined })}`, { headers: { accept: '*/*' } });
  const d = unwrap(res.data) || {};
  return {
    recordCount: num(d.recordCount),
    totalNetKg: num(d.totalNetKg),
    totalFee: num(d.totalFee),
    averageNetKg: num(d.averageNetKg),
    matchedCount: num(d.matchedCount),
    plateMismatchCount: num(d.plateMismatchCount),
    unmatchedCount: num(d.unmatchedCount),
    balanceSupported: d.balance !== undefined && d.balance !== null,
    hasDeposits: d.hasDeposits === true,
    totalDeposits: num(d.totalDeposits),
    totalFeesAllTime: num(d.totalFeesAllTime),
    balance: num(d.balance),
  };
};

export const getDumpRecords = async (params: DumpQueryParams): Promise<DumpRecordPage> => {
  const res = await api.get(`/DumpImport/records?${buildDumpQuery(params)}`, { headers: { accept: '*/*' } });
  const d = unwrap(res.data) || {};
  const records: DumpRecord[] = Array.isArray(d.records) ? d.records : [];
  return {
    records,
    totalCount: num(d.totalCount),
    page: num(d.page) || params.page || 1,
    pageSize: num(d.pageSize) || params.pageSize || records.length,
    totalPages: num(d.totalPages),
  };
};

/** Excel export adresi (RNBlobUtil ile Bearer token'la indirilir). */
export const buildDumpExportUrl = (params: DumpQueryParams): string => `${API_BASE_URL}/DumpImport/records/export?${buildDumpQuery({ ...params, page: undefined, pageSize: undefined })}`;

/** Eski API (uç yok) mu? */
export const isEndpointMissing = (e: any): boolean => e?.response?.status === 404;

// İSTAÇ bilgileri kayıtlı değil: API 404 + Türkçe mesaj döner ("Önce İSTAÇ kullanıcı adı ve şifresini kaydediniz.").
// Uç hiç yoksa (eski sunucu) 404'ün gövdesinde mesaj olmaz → isEndpointMissing.
export const isIstacNotConfigured = (e: any): boolean => e?.response?.status === 404 && !!e?.response?.data?.errors?.[0];

// ── Para yatırma (Hesapta Kalan). Eski API'de uçlar yok (404) → isEndpointMissing ile yakalanır.

/** 200 dönüp isSuccess:false gelirse de API mesajıyla hata fırlat (ekran errors[0]'ı gösterir). */
const ensureSuccess = (body: any) => {
  if (body && typeof body === 'object' && body.isSuccess === false) {
    const err: any = new Error(body.errors?.[0] || 'İşlem başarısız.');
    err.response = { data: body };
    throw err;
  }
  return unwrap(body);
};

const normalizeDeposit = (x: any): DumpDeposit => ({
  id: String(x?.id ?? ''),
  companyId: x?.companyId ?? null,
  sourceFormat: x?.sourceFormat ?? null,
  sourceName: x?.sourceName ?? null,
  amount: num(x?.amount),
  depositDate: x?.depositDate ?? null,
  note: x?.note ?? null,
  createdByName: x?.createdByName ?? null,
  createdDate: x?.createdDate ?? null,
});

export const getDeposits = async (companyId: string, source: DumpSource = ''): Promise<DumpDeposit[]> => {
  const res = await api.get(`/DumpImport/deposits?${buildDumpQuery({ companyId, source })}`, { headers: { accept: '*/*' } });
  const d = ensureSuccess(res.data);
  return Array.isArray(d) ? d.map(normalizeDeposit).filter(x => x.id) : [];
};

export const addDeposit = async (body: NewDumpDeposit): Promise<DumpDeposit> => {
  const res = await api.post('/DumpImport/deposits', body);
  return normalizeDeposit(ensureSuccess(res.data));
};

export const deleteDeposit = async (id: string): Promise<boolean> => {
  const res = await api.delete(`/DumpImport/deposits/${encodeURIComponent(id)}`);
  ensureSuccess(res.data);
  return true;
};

// ── Excel yükleme (mobil dosya seçici ile; web'deki "Döküm Verileri" yüklemesiyle aynı uç)

export type DumpImportResult = {
  id: string;
  fileName: string;
  sourceFormat: string | null;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  skippedRows: number;
  matchedRows: number;
  plateMismatchRows: number;
};

export const uploadDumpExcel = async (companyId: string, fileName: string, fileBase64: string): Promise<DumpImportResult> => {
  // Büyük dosyada base64 gövde uzun sürebilir → uzun zaman aşımı
  const res = await api.post('/DumpImport', { companyId, fileName, fileBase64 }, { timeout: 120000 });
  const d: any = ensureSuccess(res.data) || {};
  return {
    id: String(d.id ?? ''),
    fileName: d.fileName ?? fileName,
    sourceFormat: d.sourceFormat ?? null,
    totalRows: num(d.totalRows),
    insertedRows: num(d.insertedRows),
    duplicateRows: num(d.duplicateRows),
    skippedRows: num(d.skippedRows),
    matchedRows: num(d.matchedRows),
    plateMismatchRows: num(d.plateMismatchRows),
  };
};

/** Yükleme sonucu özeti (web'deki mesajla aynı) */
export const formatImportResult = (r: DumpImportResult): string => {
  let s = `${r.totalRows} satır okundu — ${r.insertedRows} yeni, ${r.duplicateRows} daha önce yüklenmiş (atlandı)`;
  if (r.skippedRows > 0) s += `, ${r.skippedRows} etiket no'su eksik`;
  s += `. ${r.matchedRows} sefer eşleşti`;
  s += r.plateMismatchRows > 0 ? `, ${r.plateMismatchRows} seferde FARKLI PLAKA.` : '.';
  return s;
};

// ── İSTAÇ Hafriyat Online entegrasyonu (Profil → Entegrasyonlar & Döküm → İSTAÇ'tan Çek)

export type IstacIntegration = {
  companyId: string;
  configured: boolean;
  username: string;
  hasPassword: boolean;
  isActive: boolean;
  lastSyncAt?: string | null;
  lastSyncSuccess?: boolean | null;
  lastSyncError?: string | null;
  lastSyncedUntil?: string | null;
  updatedDate?: string | null;
};

export type IstacSiteSyncResult = {
  siteId: string;
  siteName: string;
  reportedRows: number;
  lastDataTime?: string | null;
  insertedRows: number;
  duplicateRows: number;
  matchedRows: number;
  plateMismatchRows: number;
  importId?: string | null;
  error?: string | null;
};

export type IstacSyncResult = {
  startDate: string;
  endDate: string;
  sites: IstacSiteSyncResult[];
  insertedRows: number;
  duplicateRows: number;
  matchedRows: number;
  plateMismatchRows: number;
  hasErrors: boolean;
};

const normalizeIstacIntegration = (d: any, fallbackCompanyId: string): IstacIntegration => ({
  companyId: String(d?.companyId ?? fallbackCompanyId),
  configured: d?.configured === true,
  username: String(d?.username ?? ''),
  hasPassword: d?.hasPassword === true,
  isActive: d?.configured ? d?.isActive !== false : true,
  lastSyncAt: d?.lastSyncAt ?? null,
  lastSyncSuccess: typeof d?.lastSyncSuccess === 'boolean' ? d.lastSyncSuccess : null,
  lastSyncError: d?.lastSyncError ?? null,
  lastSyncedUntil: d?.lastSyncedUntil ?? null,
  updatedDate: d?.updatedDate ?? null,
});

export const getIstacIntegration = async (companyId: string): Promise<IstacIntegration> => {
  const res = await api.get(`/Integrations/istac?companyId=${encodeURIComponent(companyId)}`, { headers: { accept: '*/*' } });
  return normalizeIstacIntegration(ensureSuccess(res.data), companyId);
};

export const saveIstacIntegration = async (body: { companyId: string; username: string; password?: string; isActive?: boolean }): Promise<IstacIntegration> => {
  const res = await api.put('/Integrations/istac', body);
  return normalizeIstacIntegration(ensureSuccess(res.data), body.companyId);
};

export const deleteIstacIntegration = async (companyId: string): Promise<boolean> => {
  const res = await api.delete(`/Integrations/istac?companyId=${encodeURIComponent(companyId)}`);
  ensureSuccess(res.data);
  return true;
};

/**
 * İSTAÇ günlük raporlarını otomatik (Tesseract OCR + en fazla 5 deneme) çeker ve döküm verilerine ekler.
 */
export const syncIstac = async (body: { companyId: string; startDate?: string; endDate?: string }): Promise<IstacSyncResult> => {
  const res = await api.post('/Integrations/istac/sync', body, { timeout: 120000 });
  const d: any = ensureSuccess(res.data) || {};
  const sites: IstacSiteSyncResult[] = Array.isArray(d.sites)
    ? d.sites.map((s: any) => ({
        siteId: String(s?.siteId ?? ''),
        siteName: String(s?.siteName ?? ''),
        reportedRows: num(s?.reportedRows),
        lastDataTime: s?.lastDataTime ?? null,
        insertedRows: num(s?.insertedRows),
        duplicateRows: num(s?.duplicateRows),
        matchedRows: num(s?.matchedRows),
        plateMismatchRows: num(s?.plateMismatchRows),
        importId: s?.importId ?? null,
        error: s?.error ?? null,
      }))
    : [];
  return {
    startDate: String(d.startDate ?? ''),
    endDate: String(d.endDate ?? ''),
    sites,
    insertedRows: num(d.insertedRows),
    duplicateRows: num(d.duplicateRows),
    matchedRows: num(d.matchedRows),
    plateMismatchRows: num(d.plateMismatchRows),
    hasErrors: d.hasErrors === true,
  };
};

export const formatIstacSyncSummary = (r: IstacSyncResult): string => {
  const start = formatDumpDateTime(r.startDate).date;
  const end = formatDumpDateTime(r.endDate).date;
  let s = `İSTAÇ (${start} – ${end}): ${r.insertedRows} yeni kayıt, ${r.duplicateRows} zaten vardı, ${r.matchedRows} seferle eşleşti`;
  s += r.plateMismatchRows > 0 ? `, ${r.plateMismatchRows} plaka farkı.` : '.';
  return s;
};
