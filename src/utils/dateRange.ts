import { useCallback, useState } from 'react';

// ── Tarih aralığı filtresi (İş detayı ve Araç Yönetimi sefer listeleri ortak kullanır)
// Tarihler "DD.MM.YYYY" metni olarak tutulur; varsayılan aralık bu ayın tamamıdır.
// İş detayı "tüm zamanlar" ile açılır (defaultAllTime): iki uç da boş ("") = filtre yok.

/** Bugünün TR (UTC+3) tarihi, "DD.MM.YYYY" */
export const todayDDMMYYYY = (): string => {
  const trMs = Date.now() + 3 * 60 * 60000;
  const d = new Date(trMs);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
};

/** Bu ayın 1'i */
export const monthStartDDMMYYYY = (): string => `01.${todayDDMMYYYY().slice(3)}`;

/** Bu ayın son günü (gün sayısı da TR tarihinden; cihaz saat dilimi farklıysa "31.11" gibi geçersiz tarih çıkmasın) */
export const monthEndDDMMYYYY = (): string => {
  const monthYear = todayDDMMYYYY().slice(3);
  const [m, y] = monthYear.split('.').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(last).padStart(2, '0')}.${monthYear}`;
};

/** "DD.MM.YYYY" → YYYYMMDD sayısı (karşılaştırma için); geçersizse null */
export const ddmmyyyyToKey = (str: string): number | null => {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return null;
  const [d, m, y] = str.split('.').map(Number);
  return y * 10000 + m * 100 + d;
};

/** "DD.MM.YYYY" → "YYYY-MM-DD" (Excel export query formatı) */
export const ddmmyyyyToYMD = (str: string): string => {
  const [d, m, y] = str.split('.');
  return `${y}-${m}-${d}`;
};

/** Date (cihaz yerel saati) → "DD.MM.YYYY" */
export const dateToDDMMYYYY = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

/**
 * Sefer zamanı aralıkta mı? (uçlar dahil). Listede gösterilen tarih new Date(timeOfHaul) yerel tarihi olduğu için
 * karşılaştırma da onunla yapılır (Türkiye'deki cihazda TR tarihi). Tarih okunamazsa gösterilir.
 */
export const isInDateRange = (timeOfHaul: string | undefined, startKey: number | null, endKey: number | null): boolean => {
  if (!timeOfHaul) return true;
  const d = new Date(timeOfHaul);
  if (isNaN(d.getTime())) return true;
  const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  if (startKey !== null && key < startKey) return false;
  if (endKey !== null && key > endKey) return false;
  return true;
};

/**
 * Tarih aralığı durumu: başlangıç bitişten sonra olamaz (gerekirse diğer ucu eşitler), varsayılan bu ayın tamamı.
 * defaultAllTime: varsayılan "tüm zamanlar" (iki uç boş). Boşken bir uç seçilirse diğeri de doldurulur
 * (başlangıç → bitiş bugün, bitiş → başlangıç aynı gün) ki ekran ve Excel aynı aralığı kullansın.
 */
export const useDateRange = (options?: { defaultAllTime?: boolean }) => {
  const allTime = options?.defaultAllTime === true;
  const defaultStart = useCallback(() => (allTime ? '' : monthStartDDMMYYYY()), [allTime]);
  const defaultEnd = useCallback(() => (allTime ? '' : monthEndDDMMYYYY()), [allTime]);
  const [rangeStart, setRangeStart] = useState<string>(defaultStart);
  const [rangeEnd, setRangeEnd] = useState<string>(defaultEnd);

  const changeStart = useCallback((v: string) => {
    setRangeStart(v);
    setRangeEnd(prevEnd => {
      const s = ddmmyyyyToKey(v);
      const e = ddmmyyyyToKey(prevEnd);
      if (e === null) {
        const today = todayDDMMYYYY();
        return s !== null && s > (ddmmyyyyToKey(today) ?? 0) ? v : today;
      }
      return s !== null && s > e ? v : prevEnd;
    });
  }, []);

  const changeEnd = useCallback((v: string) => {
    setRangeEnd(v);
    setRangeStart(prevStart => {
      const s = ddmmyyyyToKey(prevStart);
      const e = ddmmyyyyToKey(v);
      if (s === null) return v;
      return e !== null && e < s ? v : prevStart;
    });
  }, []);

  const resetRange = useCallback(() => {
    setRangeStart(defaultStart());
    setRangeEnd(defaultEnd());
  }, [defaultStart, defaultEnd]);

  const setRange = useCallback((start: string, end: string) => {
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const isDefaultRange = rangeStart === defaultStart() && rangeEnd === defaultEnd();
  const startKey = ddmmyyyyToKey(rangeStart);
  const endKey = ddmmyyyyToKey(rangeEnd);

  return { rangeStart, rangeEnd, startKey, endKey, isDefaultRange, changeStart, changeEnd, resetRange, setRange };
};
