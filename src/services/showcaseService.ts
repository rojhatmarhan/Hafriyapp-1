import { api, BASE_HOST } from './api';

// Firma tanıtımı (api/Showcase). Her cevap Result<T> = { isSuccess, data, errors } ile sarılı; null alanlar JSON'a yazılmaz,
// bu yüzden tiplerde opsiyoneldir. Hata mesajı (Türkçe) errors[0]'dadır → showcaseHata().
// Hikaye, yorum ve puan Faz 3: şimdilik ratingAverage 0, reviewCount 0, hasActiveStories false gelir.

export type ShowcaseProvince = { code: number; name: string };
export type ShowcaseProvinceCount = ShowcaseProvince & { count: number };
export type ShowcasePhotoTemplate = { title: string; hint: string; example: string };

export type ShowcaseOptions = {
  areas: string[];
  /** "" = birimsiz */
  units: string[];
  provinces: ShowcaseProvince[];
  /** İş alanı → 8 önerilen fotoğraf başlığı; "Genel" de var */
  templates: Record<string, ShowcasePhotoTemplate[]>;
  limits?: Record<string, number>;
};

export type ShowcaseListItem = {
  id: string;
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  tags?: string[];
  areas?: string[];
  provinces?: ShowcaseProvince[];
  address?: string | null;
  ratingAverage?: number;
  reviewCount?: number;
  hasActiveStories?: boolean;
  lastActivityAt?: string | null;
  /** profile | story */
  lastActivityType?: string | null;
  isSample?: boolean;
  isMine?: boolean;
};

export type ShowcaseList = {
  items: ShowcaseListItem[];
  totalCount: number;
  page: number;
  pageSize?: number;
  totalPages: number;
  provinceCounts?: ShowcaseProvinceCount[];
};

export type ShowcasePhone = { number: string; display?: string; label?: string | null; isMobile?: boolean };
export type ShowcasePhoto = { id: string; title?: string | null; caption?: string | null; imageUrl: string };
export type ShowcasePrice = { description: string; price: number; unit?: string | null };

export type ShowcaseDetail = ShowcaseListItem & {
  companyId?: string | null;
  customTags?: string[];
  email?: string | null;
  phones?: ShowcasePhone[];
  photos?: ShowcasePhoto[];
  hasPrices?: boolean;
  kdvIncluded?: boolean;
  priceUpdatedAt?: string | null;
  publishedAt?: string | null;
  canEdit?: boolean;
  isHidden?: boolean;
  /** Sadece GET my cevabında dolu */
  prices?: ShowcasePrice[] | null;
};

export type ShowcasePriceList = {
  showcaseId: string;
  name: string;
  items: ShowcasePrice[];
  kdvIncluded?: boolean;
  priceUpdatedAt?: string | null;
  firstPhone?: string | null;
};

export type MyShowcase = {
  canCreate: boolean;
  reason?: string | null;
  companies?: { id: string; name: string; hasShowcase: boolean }[];
  companyId?: string | null;
  showcase?: ShowcaseDetail | null;
  suggestedName?: string | null;
  suggestedPhone?: string | null;
  suggestedAddress?: string | null;
  suggestedLogoUrl?: string | null;
};

export type SaveShowcasePayload = {
  companyId?: string | null;
  name: string;
  areas: string[];
  tags: string[];
  provinceCodes: number[];
  address: string;
  phones: { number: string; label: string }[];
  email: string;
  /** null = değişmez, "" = kaldır, "data:image/jpeg;base64,..." = yeni logo */
  logo: string | null;
  /** Sırayla, ilki kapak. Var olan fotoğraf sadece id ile gönderilir. */
  photos: { id?: string; imageBase64?: string; title: string; caption: string }[];
  prices: { description: string; price: number; unit: string }[];
  kdvIncluded: boolean;
};

/**
 * Tanıtım görsel adresi. Sunucu göreli yol döner (/uploads/...). Debug'da yerel API'nin (test veritabanı) kendi dosyaları
 * gösterilsin diye BASE_HOST kullanılır (UPLOADS_HOST her zaman canlıyı gösterir, burada kullanılmaz).
 */
export const showcaseImageUrl = (path?: string | null, host: string = BASE_HOST): string | null => {
  if (!path) return null;
  if (/^(https?:|data:|file:|content:|ph:|assets-library:)/i.test(path)) return path;
  return host + (path.startsWith('/') ? '' : '/') + path;
};

/** API hatasından kullanıcıya gösterilecek metin: errors[0] ya da message; yoksa `yedek` */
export const showcaseHata = (e: any, yedek = 'Bir hata oluştu. Lütfen tekrar deneyin.'): string => {
  const d = e?.response?.data;
  const m = d?.errors?.[0] || d?.Errors?.[0] || d?.message || d?.Message;
  if (m) return String(m);
  if (e && !e.response && (e.message === 'Network Error' || e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK')) {
    return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  }
  return yedek;
};

/** Uç bu API sürümünde yok mu (eski API yayında) */
export const showcaseYok = (e: any): boolean => e?.response?.status === 404;

const veri = <T>(res: { data: any }): T => {
  const d = res.data;
  if (d && d.isSuccess === false) {
    const err: any = new Error(d.errors?.[0] || 'İşlem başarısız');
    err.response = { status: 400, data: d };
    throw err;
  }
  return (d?.data ?? d) as T;
};

let secenekSozu: Promise<ShowcaseOptions> | null = null;

/** Sabit listeler (bir kez alınır, bellekte tutulur). Eski API'de 404 → özellik yok. */
export const getShowcaseOptions = (): Promise<ShowcaseOptions> => {
  if (!secenekSozu) {
    secenekSozu = api.get('/Showcase/options').then(r => veri<ShowcaseOptions>(r));
    secenekSozu.catch(() => {
      secenekSozu = null;
    });
  }
  return secenekSozu;
};

export const getShowcaseList = async (p: { search?: string; province?: number | null; page?: number; pageSize?: number }): Promise<ShowcaseList> => {
  const params: Record<string, any> = { page: p.page ?? 1, pageSize: p.pageSize ?? 20 };
  if (p.search && p.search.trim()) params.search = p.search.trim();
  if (p.province) params.province = p.province;
  return veri<ShowcaseList>(await api.get('/Showcase', { params }));
};

export const getShowcaseDetail = async (id: string): Promise<ShowcaseDetail> => veri<ShowcaseDetail>(await api.get(`/Showcase/${id}`));

export const getShowcasePrices = async (id: string): Promise<ShowcasePriceList> => veri<ShowcasePriceList>(await api.get(`/Showcase/${id}/prices`));

export const getMyShowcase = async (companyId?: string | null): Promise<MyShowcase> =>
  veri<MyShowcase>(await api.get('/Showcase/my', { params: companyId ? { companyId } : undefined }));

export const saveMyShowcase = async (payload: SaveShowcasePayload): Promise<ShowcaseDetail> =>
  veri<ShowcaseDetail>(await api.put('/Showcase/my', payload, { timeout: 120000 }));

export const deleteMyShowcase = async (companyId?: string | null): Promise<boolean> =>
  veri<boolean>(await api.delete('/Showcase/my', { params: companyId ? { companyId } : undefined }));

// Yayın sonrası liste ekranı odaklanınca yenilensin diye basit bir işaret
let degisti = false;
export const markShowcaseChanged = () => {
  degisti = true;
};
export const consumeShowcaseChanged = (): boolean => {
  const d = degisti;
  degisti = false;
  return d;
};
