import RNBlobUtil from 'react-native-blob-util';
import { todayDDMMYYYY } from './dateRange';

// Excel indirmeleri: dosya anlamlı adla kaydedilir (eskiden fileCache "RNBlobTmp_…" gibi rastgele ad veriyordu).
// Ad paylaş/dosyalar ekranında aynen görünür: "Seferler_Eyüpsultan Okul İnşaatı_01.10.2026-25.10.2026.xlsx".

/** Dosya adında sorun çıkaran karakterleri temizler; Türkçe harfler kalır. */
const temizle = (s: string): string =>
  s
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Parçaları "_" ile birleştirip .xlsx adı yapar; boş parçalar atlanır. Örn: excelDosyaAdi('Seferler', şantiyeAdı, '01.10.2026-25.10.2026') */
export const excelDosyaAdi = (...parcalar: (string | null | undefined)[]): string => {
  const ad = parcalar
    .map(p => temizle(p ?? ''))
    .filter(Boolean)
    .join('_')
    .slice(0, 100);
  return `${ad || 'HafriyApp'}.xlsx`;
};

/** Tarih aralığı parçası: "01.10.2026-25.10.2026"; aralık yoksa bugünün tarihi. */
export const excelTarihParcasi = (baslangic?: string | null, bitis?: string | null): string =>
  baslangic && bitis ? `${baslangic}-${bitis}` : todayDDMMYYYY();

/** Excel'i verilen adla önbellek klasörüne indirir (aynı adlı eski dosyanın üzerine yazar). */
export const excelIndir = async (url: string, token: string, dosyaAdi: string) => {
  const path = `${RNBlobUtil.fs.dirs.CacheDir}/${dosyaAdi}`;
  try {
    if (await RNBlobUtil.fs.exists(path)) await RNBlobUtil.fs.unlink(path);
  } catch {
    // silinemezse indirme yine aynı yola yazar
  }
  return RNBlobUtil.config({ path }).fetch('GET', url, { Authorization: `Bearer ${token}` });
};
