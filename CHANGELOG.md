# CHANGELOG — HafriyApp Mobil

Kurallar: [docs/UYUMLULUK.md](docs/UYUMLULUK.md). En yeni kayıt en üstte.
Biçim: `## [Mobil versionName (versionCode/build)] — tarih` → Eklendi / Düzeltildi / Değişti / Native → Uyumluluk
(gereken en düşük API sürümü, yerel veri dönüşümü).

## [Yayınlanmadı]

### İnceleme düzeltmeleri + testler
#### Düzeltildi
- Sohbet sabitlemesinin sunucuya taşınması: üye olunmayan gruplar atlanır (kullanıcı sessizce üye yapılmaz), taşıma tek seferlik.
- Türkçe İ/ı araması (`src/utils/trSearch.ts`): grup listesi, il seçici ve sefer araması "istanbul" ile "İSTANBUL"u eşleştirir;
  sunucudan gelen arama sonuçları istemci filtresiyle gizlenmez.
- Ay sonu tarihi saat dilimine göre geçersiz tarih üretmiyor; basılı fişte "Döküm Fişi" satırı tek satıra sığar.
- QR ile eski kayıtta yanlış seferin açılması (not içinde tam numara eşleşmesi); İşlerim sabitleme yarışında sunucu durumu uygulanır.
- Eski yazı boyutu tercihleri telefondan silinmiyor (yerel veri kuralı).
#### Testler
- Jest altyapısı onarıldı (native modül mock'ları, ESM dönüşümü) — `npx jest`: 10 dosya, 71 test.

### Faz 3
#### Eklendi
- Sefer satırında döküm durumu (`src/utils/dumpFormat.ts`; JobDetails + SupplierVehicles): "Döküm: 26,43 t · 4.376,81 ₺" /
  kırmızı "⚠ Farklı plaka döküme girdi: 34…" (+ "⚠ Plaka" rozeti) / "Döküm bekleniyor…". Ekrandaki fişte "Kantar :" satırı.
  Basılı fiş değişmedi.
#### Uyumluluk
- Gereken API: Faz 3 (yeni alanlar yoksa satırlar eskisi gibi görünür).
- Bildirim (`dump_plate_mismatch`): ön planda Alert, arka planda sistem bildirimi; tıklayınca uygulama açılır (ekrana yönlendirme yok — uygulamada navigation ref yok).
- Mobilden Excel yükleme yok (dosya seçici native paket gerektirir) — şimdilik Web'den.
- Native: yok.

### Faz 2
#### Eklendi
- Seferde ayrı **döküm fişi** alanı (`dumpTicketNo`): Sefer Gir, Manuel ve düzenleme ekranlarında "Döküm fişi…" kutusu + QR tarama
  (`src/components/DumpTicketInput.tsx`; Aztec `12345-…` → `12345`). Listede plakanın altında, ekran ve basılı fişte "Döküm Fişi" satırı.
  Çevrimdışı kuyruk da taşır (`pendingHaulSlice`, opsiyonel alan).
- İşlerim'de **iş sabitleme** (📌, sunucuda; API desteklemiyorsa buton gizli).
- Sohbet sabitlemesi **sunucuya** taşındı (`POST /ChatGroup/{id}/pin`); telefondaki `pinned_chat_groups` bir kez sunucuya aktarılır
  (`pinned_chat_groups_migrated` bayrağı), eski anahtar silinmez. API `isPinned` döndürmüyorsa eski yerel davranış.
#### Değişti
- Yeni Sefer Kaydı: "Plaka Tara" butonu kalktı, kamera ikonu plaka kutusunun içinde (Manuel ve düzenlemede de). Not alanı sadece not.
- İş detayı: buton satırı "İş Notları · Manuel · + Sefer Gir" (🔄 kalktı, aşağı çekerek yenileme duruyor). Yıl/Ay seçicileri yerine tek arama
  çubuğu: QR · "Plaka, döküm, seri no…" · başlangıç ▸ bitiş tarihi (`CalendarDateButton`). Varsayılan aralık bu ayın tamamı (eski ay filtresiyle aynı).
  Arama döküm fişi no'yu da kapsar (eski kayıtlarda not alanını).
- Excel indirme seçili tarih aralığıyla (`/filtered/export`).
#### Uyumluluk
- Gereken API: döküm fişi ve iş sabitleme için Faz 2 API'si (migration uygulanmış). Eski API ile: döküm fişi kaydedilmez/görünmez,
  sabitleme butonu görünmez, sohbet sabitlemesi telefonda kalır — çökme yok.
- Yerel veri: `pinned_chat_groups` korunur; kuyruktaki eski seferler `dumpTicketNo` olmadan gönderilir.
- Native: yok (ikonlar `react-native-svg`, tarih seçici zaten kurulu).

### Faz 1
#### Düzeltildi
- İş Notları yeniden yazıldı (`src/components/JobNotesModal.tsx`, tek Modal): üstte Not Ekle / Mazot Ver / Gider Ekle butonları, altında liste;
  basılan butonun kartı açılır. Düzenleme aynı ekranda (iOS'ta görünmeyen ikinci Modal + donma sorunu giderildi). Tanker Stok / Toplam Kayıt kaldırıldı.
  Klavye: dışarı dokununca / kaydırınca / "Bitti" ile kapanır. Not örneği "Örn: Kepçe tam gün mesai". Başarı mesajı Alert yerine satır içi.
- Sohbet grup listesi: "Tüm Türkiye"de ilk 20 grubun ötesi görünmüyordu → kaydırdıkça sonraki sayfalar yüklenir. Grup araması sunucuya da gider (`?search=`).
- Sohbette yukarı kaydırınca eski mesajlar yüklenir (`before` cursor; saklama 30 güne çıktı).
#### Değişti
- Sohbet yazı boyutu ayarı (A±) kaldırıldı; mesajlar sabit 16 / kalın.
- Pazar ikonu: sade etiket (`src/components/TagIcon.tsx`, SVG).
- Grup ayarlarında il düzenleme (`src/components/ProvinceMultiSelect.tsx`; grup oluşturma da aynı bileşeni kullanır).
- Düzenle/Sil butonları API'nin not bazındaki `canManage` alanına göre (yoksa eski `isOwner` kuralı).
#### Uyumluluk
- Gereken en düşük API: Faz 1 API'si önerilir. Eski API ile: il düzenleme sessizce kaydedilmez, not düzenleme yetkisi eski kurala göre; çökme yok.
- Yerel veri: eski yazı boyutu anahtarları (`@hafriyapp_chat_fontSize/Bold`) bir kez silinir. `pinned_chat_groups` değişmedi.
- Native: yok.

### Eklendi
- Dokümanlar: `CLAUDE.md` (yeniden yazıldı), `README.md` (geliştirici rehberi), `docs/UYUMLULUK.md`, bu dosya.
- Her API isteğine `X-App-Platform`, `X-App-Version`, `X-App-Build` başlıkları (`src/services/api.ts`).

### Düzeltildi
- Token'ı her istekte `console.log` ile yazan satır kaldırıldı (`api.ts`).
- `JobDetails` her render'da işi JSON olarak loglamıyor (performans).

### Değişti
- `jest.config.js`: `react-native-device-info` için paketin kendi jest mock'u. (Testler bu değişiklikten önce de keychain/AsyncStorage
  mock'u eksik olduğu için çalışmıyordu; o durum aynen devam ediyor.)

### Uyumluluk
- Gereken en düşük API: herhangi biri (API başlıkları henüz kullanmıyor, bilinmeyen başlıkları yok sayar).
- Native: yok (`react-native-device-info` zaten kurulu ve bağlı).

## [Android 1.7.2 (17) / iOS 1.0.7 (14)] — mevcut mağaza sürümleri
- Bu dosya oluşturulmadan önceki son yayınlanan sürümler (referans).
