# CHANGELOG — HafriyApp Mobil

Kurallar: [docs/UYUMLULUK.md](docs/UYUMLULUK.md). En yeni kayıt en üstte.
Biçim: `## [Mobil versionName (versionCode/build)] — tarih` → Eklendi / Düzeltildi / Değişti / Native → Uyumluluk
(gereken en düşük API sürümü, yerel veri dönüşümü).

## [Yayınlanmadı]

### Excel indirmeleri: iOS'ta iş notları + anlamlı dosya adları
#### Düzeltildi
- **iOS: İş Notları & Giderler → Excel hiçbir şey yapmıyordu.** `RNBlobUtil.ios.openDocument` belgeyi ana ekrandan sunar; notlar penceresi
  (Modal) açıkken iOS bunu sessizce yutuyordu. Artık iOS'un Paylaş penceresi açılır (Modal'ın üstünde; Dosyalar'a kaydet / Excel'de aç /
  gönder). Paylaş açılamazsa pencere kapatılıp belge açılır (JobDetails Excel'iyle aynı yöntem). Android aynı.
- **Excel dosya adları** rastgeleydi (`RNBlobTmp_…xlsx`). Ortak `src/utils/excelDownload.ts` (`excelIndir`, `excelDosyaAdi`,
  `excelTarihParcasi`) ile anlamlı adlar: `Is_Notlari_<şantiye>_<gg.aa.yyyy>`, `Seferler_<şantiye>_<aralık>`, `Tum_Seferler_<tarih>`,
  `Arac_Seferleri_<aralık>` (İş Notları, JobDetails, MyJobs ×2, SupplierVehicles). Döküm Excel'i zaten anlamlı adla iniyordu.
#### Native
- `ios/Podfile.lock`: `react-native-document-picker` podu (Excel yükleme için `npm install` + `pod install` sonrası; yeni native paket).
- iOS build numarası 14 → 15 (TestFlight).
#### Uyumluluk
- API değişmedi; yerel veri değişmedi.

### Menü
- Yan menüdeki "EK UYGULAMALAR" bölümü kaldırıldı (WebToolScreen ekranı duruyor; Döküm Excel yükleme yönlendirmesi kullanıyor).

### Sayfa üstleri kayar, Pazar kartları her ekrana sığar (sadece düzen)
#### Değişti
- Liste ekranlarında sayfanın kendi üst kısmı (başlık, sekmeler, "Yeni Araç Ekle"/"Yenile", özet kartları, Firma Tanıtımları
  kartı) artık içerikle birlikte kayar; sadece arama/filtre satırı üstte sabit (sticky) kalır. Küçük telefonda liste için yer açılır.
  Sarı uygulama başlığı ve alt sekme çubuğu değişmedi.
  - İşlerim (`MyJobs`): "İşlerim | Döküm" + başlık kayar, "İş adına göre ara ↻ ⬇" sabit. Döküm (`DumpOverview`): sekme, kaynak,
    Hesapta Kalan ve KPI kartları kayar; QR/tarih arama çubuğu sabit, iş filtresi ve sütun başlıkları kayar.
  - Araç Yönetimi (`SupplierVehicles`): başlık, "Araçlar | Seferler" ve buton kayar; Seferler'de özet çubuğu kayar, arama çubuğu sabit.
    Dar ekranda "＋ Yeni Araç Ekle" alt satıra iner (taşmaz).
  - Seferlerim (`DriverJobs`): başlık + araç durumu ve istatistik kayar; dönem filtresi (Tümü/Bugün/Bu Hafta/Bu Ay) sabit.
  - Ana sayfa (`SupplierHome`/`DriverHome`): "FİRMA SAYFALARI", Firma Tanıtımları ve uyarı kayar; "Ara | Tüm Türkiye | +" sabit.
  - Pazar ilan listesi (`MyAds`): geri/başlık/"+ İlan Ver" ve "Tüm İlanlar | İlanlarım" kayar; il filtresi sabit.
  - Piyasa İşleri (`AllJobs`, şoför ve firma): arama satırı ("Firma veya şantiye ara | il | ↻") ve ilçe filtresi kaydırınca üstte sabit; önceden onlar da kayıp gidiyordu.
  - Pencere alçaksa (yatay telefon, yükseklik < 500 dp) arama satırı da sabitlenmez (`src/hooks/useStickySearch.ts`).
- Pazar giriş ekranı: 3 kategori kartı (Araç Kiralama, Al-Sat, Şoför İlanları) dikeyde alt alta, ekranı eşit paylaşan geniş kartlar (ikon, ad, kısa açıklama, ›); yatay telefonda tek satır; 320 dp'den tablete
  sığar, yatayda başlık kompakt, gerekirse sayfa kayar. Etiketler en çok 2 satır, dokunma alanı ≥ 44 dp, yazı büyütme sınırlı
  (`src/components/MarketCategoryPicker.tsx`). Eskiden kart genişliği açılışta ekran genişliğine sabitleniyor, kartlar kesiliyordu.
- Testler: `__tests__/stickySearchHeader.test.tsx`, `__tests__/MarketCategoryPicker.test.tsx`.
#### Uyumluluk
- API çağrıları, iş mantığı ve yerel veri değişmedi; native değişiklik yok.

### Firma tanıtımı — Faz 2 (mobil)
#### Eklendi
- Ana sayfadaki "Firma Tanıtımları" kartı artık WebView yerine native ekranları açar (`src/screens/showcase/`), tasarım
  hafriyapp.com/firma-tanitimi deneme sürümüyle birebir (sarı `#FAD211`, asfalt `#1E1E1C`, Barlow / Barlow Condensed):
  - **ShowcaseList** — "Firmalar": arama (Türkçe harf duyarsız, 350 ms bekleyip sunucuda), il filtresi ("Tüm iller", "İstanbul (3)"),
    "n firma bulundu · Temizle", kartlar (16:9 kapak, "Örnek" rozeti, baş harf yedeği, "A, B ve n il daha", "Profil güncellendi,
    3 saat önce"), boş durumlar, aşağı çekip yenileme, sayfalama. "+ Firmanı tanıt": `GET /Showcase/my` → yetki yoksa sebep gösterilir.
  - **ShowcaseDetail** — firma sayfası: sarı başlık (logo, etiketler, ad, "Henüz yorum yok", hizmet illeri, adres → Google Haritalar,
    telefonlar `tel:` + cepte WhatsApp, e-posta), sahibine "Sayfayı düzenle", "Fiyat listesi" penceresi (tablo, KDV, güncelleme
    tarihi, "Ara"), başlıklı fotoğraflar, yorum bölümünün boş hali.
  - **ShowcaseForm** — "Firmanı tanıt / düzenle" + aynı ekranda önizleme ("Önizle" → "Yayınla", `PUT /Showcase/my`): logo, ad,
    iş alanları (etiketleri ve 8 fotoğraf yuvasının başlıklarını değiştirir, `/Showcase/options` şablonları), etiketler (≤6),
    hizmet illeri (yazınca öneri), adres, telefonlar (≤5), e-posta, 8 fotoğraf yuvası (Kapak / Kapak yap / Değiştir / Sil),
    fiyat listesi ("1.250", "1250,50"; birimler). Doğrulama ve hata metinleri sunucuyla aynı. Yeni sayfada firma adı, telefonu ve
    adresi firmadan önerilir. Yayından sonra firma sayfası "Firmanız yayınlandı." / "Değişiklikler yayınlandı." ile açılır.
- Servis `src/services/showcaseService.ts` (görseller debug'da yerel API'den: `BASE_HOST`), yardımcılar `src/utils/showcaseFormat.ts`,
  taslak/doğrulama `src/screens/showcase/showcaseDraft.ts`. Testler: `__tests__/showcaseFormat.test.ts`, `showcaseDraft.test.ts`,
  `showcaseScreens.test.tsx`.
- Hikaye, yorum/puan, "Profili paylaş" / PDF ve "Teklif hazırla" sonraki fazlarda; ekranda yerleri `TODO Faz 3/4/5` ile işaretli,
  çalışmayan düğme gösterilmez.
#### Native
- Fontlar: Barlow 400/500/600 ve Barlow Condensed 600/700 (OFL, `assets/fonts/` + `OFL.txt`), `react-native.config.js` → `assets`
  ile `npx react-native-asset` kullanılarak bağlandı: Android `android/app/src/main/assets/fonts/`, iOS `Info.plist` `UIAppFonts` +
  Xcode projesinde "Resources" grubu ve Copy Bundle Resources. **Yeni derleme gerekir** (iki platformda); iOS'ta `pod install`
  gerekmez. Mağazaya yeni sürüm olarak çıkar (`versionCode` / `CURRENT_PROJECT_VERSION` +1).
#### Uyumluluk
- API: `GET /Showcase/options`, `GET /Showcase`, `GET /Showcase/{id}`, `GET /Showcase/{id}/prices`, `GET/PUT /Showcase/my` (backend Faz 1).
  `GET /Showcase/options` ya da liste 404 dönerse (eski API) ekran eski WebView ekranına (`CompanyShowcase`) geçer; o ekran duruyor.
- Eski mobil sürümler WebView'da hafriyapp.com/firma-tanitimi açmaya devam eder. Yerel veri biçimi değişmedi.

### Döküm ekranı, büyük ikon butonları
#### Eklendi
- İşlerim üstünde "İşlerim | Döküm" sekmesi. Döküm (`src/screens/supplier/DumpOverview.tsx`): kaynak seçici (Tüm / Cebeci / İSTAÇ),
  "İndir / Yükle" (aşağıda),
  Aktif Fiş / Top. Gider / Ortalama Tonaj kartları, eşleşme sayıları, arama (QR ile etiket no) + tarih aralığı + işe göre filtre,
  sayfalı liste (eşleşen yeşil, farklı plaka kırmızı, sefer yok gri şerit). Servis `src/services/dumpService.ts`,
  biçim yardımcıları `src/utils/dumpFormat.ts` (test: `__tests__/dumpOverviewFormat.test.ts`).
- Döküm: en üstte "Hesapta Kalan" kartı (yatırılan − tüm döküm ücretleri, kaynağa göre; eksiyse kırmızı; alt yazı
  "Yatırılan x₺ · Harcanan y₺"; yatırım yoksa "+ Yatırım ekle"). Karta basınca para yatırma paneli: kayıt listesi (tarih, saha,
  tutar, not, ekleyen; ✕ ile onaylı silme) ve "+ Para Yatırma Ekle" (Cebeci / İSTAÇ, Türkçe tutar "150.000,50", tarih GG.AA.YYYY
  metin kutusu — panel Modal olduğu için takvim Modal'ı açılmaz, not). Yardımcılar `parseTurkishAmount`, `isValidDDMMYYYY`,
  `depositDateToIso`, `formatBalanceSubtext`.
- Döküm "İndir / Yükle": "📥 İSTAÇ Dökümleri indir", "📥 Cebeci Dökümü indir" (ekrandaki tarih aralığıyla, varsayılan bu ayın
  1'i – son günü; dosya döküm sahasının kendi Excel biçiminde, yüklenen dosyanın aynısı) ve "📤 Excel yükle": telefondan .xlsx seçilir,
  `POST /DumpImport` ile yüklenir (format otomatik tanınır), sonuç web'deki gibi özetlenir (yeni / çift / eşleşen / farklı plaka).
#### Native
- Yeni paket `@react-native-documents/picker` 12.0.2 (dosya seçici). Android: yeni derleme gerekir. iOS: Mac'te `cd ios && pod install`
  sonra yeni derleme. Mağazaya yeni sürüm olarak çıkar; dosya seçici olmayan derlemede "Excel yükle" web sayfasına yönlendirir (çökmez).
#### Değişti
- Arama çubuğu QR, takvim, döküm fişi tarama ve plaka kamera butonları büyüdü (42–44 px açık sarı daire, koyu ikon);
  seçili tarih aralığında takvim butonu koyu sarı.
#### Uyumluluk
- API: `GET /DumpImport/summary`, `/DumpImport/records`, `/DumpImport/records/export` (yeni). Uç yoksa (404) ekran
  "Bu özellik için sunucu güncellemesi gerekiyor." der; diğer ekranlar etkilenmez.
- API: `GET/POST /DumpImport/deposits`, `DELETE /DumpImport/deposits/{id}` ve summary'de `hasDeposits`, `totalDeposits`,
  `totalFeesAllTime`, `balance` (yeni). Summary bu alanları döndürmezse kart gizlenir; deposits ucu 404 ise panel
  "sunucu güncellemesi gerekiyor" der.

### İş notları, Araç Yönetimi
- İş Notları: başlıktaki tutamaçtan aşağı çekerek kapatma; "📥 Excel" ile notlar ve giderler Excel olarak indirilir (API `GET /JobSite/{id}/notes/export`).
- Araç Yönetimi: arama satırı İş detayı ile aynı ortak bileşen (`src/components/HaulSearchBar.tsx`): solda QR, arama, başlangıç ▸ bitiş tarihi
  (varsayılan bu ay); yıl/ay seçicileri kaldırıldı, Excel indirme seçili aralıkla. Tarih mantığı `src/utils/dateRange.ts` (`useDateRange`).
- İşlerim kartı butonları: 📌 Başa Tuttur → Düzenle → Yayından Kaldır/Yayına Al.
- İl seçici: 82 ilin tamamı onay kutulu, aranabilir liste; "Tamam" ile aktarılır.

### Sabitleme görünümü
- İşlerim: 📌 butonu iş adının yanından kartın sol altına alındı (başlık artık tam genişlikte); tutturulunca butonun arka planı sarı.
- İşlerim ve sohbet listesi: tutturulunca ad yanında çıkan ikinci küçük 📌 kaldırıldı; sohbette tutturulmuş butonun sarısı belirginleşti.
- Debug: Excel indirme adresleri local API'ye (`API_BASE_URL`), logo/resimler her zaman canlı dosya sunucusuna (`UPLOADS_HOST`) gider.

### Bildirim düzeltmesi
#### Düzeltildi
- Uygulama açıkken gelen bildirim (ör. "… bir sefer attı") **üst üste birden fazla kez** açılıyordu; OK'a 4–5 kez basmak gerekiyordu.
  Sebep: `initPushNotifications()` 4 yerden çağrılıyor (App, useAuthBootstrap, RootNavigator, OtpScreen) ve her çağrı yeni bir
  `onMessage` dinleyicisi ekliyordu. Dinleyiciler artık tek kez kuruluyor; aynı `messageId` 60 sn içinde ikinci kez gösterilmiyor
  (`src/services/notificationService.ts`). Test: `__tests__/notificationService.test.ts`.
#### Uyumluluk
- Sadece mobil; backend değişmedi (backend her cihaza zaten tek bildirim gönderiyor). Native değişiklik yok.

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
