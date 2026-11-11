// Push bildirimi → açılacak ekran. Sadece bilinen tipler yönlendirilir; diğerleri (sefer bildirimi vb.) eskisi gibi sadece gösterilir.
// Döküm ekranı (İşlerim → Döküm): farklı plakada döküm (dump_plate_mismatch), Cebeci bağlantı durumu (cebeci_status), Cebeci'den yeni veri (cebeci_data).

export const DUMP_NOTIFICATION_TYPES = ['dump_plate_mismatch', 'cebeci_status', 'cebeci_data'] as const;

/** Bildirimin data.type'ı Döküm ekranına mı gider? */
export const isDumpNotification = (data?: Record<string, unknown> | null): boolean => {
  const type = String(data?.type ?? '')
    .trim()
    .toLowerCase();
  return (DUMP_NOTIFICATION_TYPES as readonly string[]).includes(type);
};
