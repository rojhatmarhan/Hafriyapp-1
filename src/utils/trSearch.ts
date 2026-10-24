// Türkçe arama için metin normalleştirme.
// JS'de 'İ'.toLowerCase() === 'i̇' (i + U+0307) olduğu için "izmir" araması "İzmir"i bulamıyordu.
// tr-TR ile küçültülür, birleşik nokta (U+0307) atılır ve 'ı' → 'i' yapılır (iki tarafa da uygulanır):
// "istanbul", "İstanbul", "ISTANBUL", "ıstanbul" hepsi eşleşir.

const lower = (s: string): string => {
  try {
    return s.toLocaleLowerCase('tr-TR');
  } catch {
    return s.toLowerCase();
  }
};

export const normalizeTr = (s?: string | null): string => lower(String(s ?? '')).replace(/̇/g, '').replace(/ı/g, 'i');

/** `text` içinde `query` geçiyor mu (Türkçe büyük/küçük harf duyarsız). Boş sorgu her şeyle eşleşir. */
export const trIncludes = (text: string | null | undefined, query: string | null | undefined): boolean => normalizeTr(text).includes(normalizeTr(query));
