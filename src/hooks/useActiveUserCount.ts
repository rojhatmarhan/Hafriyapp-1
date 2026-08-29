import { useState, useEffect } from 'react';

/**
 * 24 saatlik döngüde Türkiye saati baz alınarak deterministik
 * (tüm kullanıcılarda aynı dakikada aynı değeri üreten) ve pürüzsüz
 * sinüs eğrisi + gürültü ile çalışan aktif kullanıcı sayısı simülasyonu.
 *
 * - Gündüz saatleri (özellikle 14:00 - 16:00): 200 - 350 bandı
 * - Gece / sabah saatleri (özellikle 03:00 - 05:00): 50 - 70 bandı
 * - Dakika bazlı deterministik tohum (seed) ile organik dalgalanma (±8-10)
 */
export function calculateActiveUserCount(): number {
  // Türkiye saati (UTC+3)
  const trMs = Date.now() + 3 * 60 * 60000;
  const d = new Date(trMs);
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const timeInHours = hours + minutes / 60;

  // 1. Ana 24 Saatlik Sinüs Eğrisi (Pik: 15:00, Dip: 03:00)
  // Base: 175, Genlik: 110 -> Min: 65, Max: 285
  const angle = ((timeInHours - 9) * Math.PI) / 12;
  const baseCurve = 175 + 110 * Math.sin(angle);

  // 2. Doğal gün içi dalgalanma için 2. harmonik alt dalga
  const subHarmonic = 18 * Math.sin(((timeInHours - 11) * 2 * Math.PI) / 12);

  // 3. Deterministik Dakika Gürültüsü (Seed Hash)
  // Aynı dakikadaki tüm cihazlar birebir aynı sayıyı üretir
  const minuteBucket = Math.floor(trMs / 60000);
  const hash = Math.sin(minuteBucket * 12.9898 + 78.233) * 43758.5453;
  const frac = hash - Math.floor(hash); // 0 ile 1 arası
  const noise = Math.floor(frac * 21) - 10; // -10 ile +10 arası

  const total = Math.round(baseCurve + subHarmonic + noise);

  // Güvenlik sınırları (min 50, max 350)
  return Math.max(50, Math.min(350, total));
}

export function useActiveUserCount(): number {
  const [count, setCount] = useState<number>(() => calculateActiveUserCount());

  useEffect(() => {
    // İlk renderda hemen güncelle
    setCount(calculateActiveUserCount());

    // Her 1 dakikada bir (60 saniye) reaktif olarak güncelle
    const timer = setInterval(() => {
      setCount(calculateActiveUserCount());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return count;
}
