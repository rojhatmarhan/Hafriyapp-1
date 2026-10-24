import { useWindowDimensions } from 'react-native';

// Liste ekranlarında sayfanın üst kısmı (başlık, sekmeler, butonlar) içerikle birlikte kayar; sadece arama satırı
// üstte sabit (sticky) kalabilir. Pencere çok alçaksa (ör. yatay telefon ~800×360) arama satırı da sabitlenmez,
// tüm sayfa kayar — liste için yer kalsın.
export const STICKY_MIN_WINDOW_HEIGHT = 500;

export function shouldStickSearch(windowHeight: number): boolean {
  return windowHeight >= STICKY_MIN_WINDOW_HEIGHT;
}

export function useStickySearch(): boolean {
  const { height } = useWindowDimensions();
  return shouldStickSearch(height);
}
