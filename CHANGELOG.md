# CHANGELOG — HafriyApp Mobil

Kurallar: [docs/UYUMLULUK.md](docs/UYUMLULUK.md). En yeni kayıt en üstte.
Biçim: `## [Mobil versionName (versionCode/build)] — tarih` → Eklendi / Düzeltildi / Değişti / Native → Uyumluluk
(gereken en düşük API sürümü, yerel veri dönüşümü).

## [Yayınlanmadı]

### Döküm listesinde farklı plaka
- "Yükleme" sütunu "Farklı plaka: 34ABC123" (Web ile aynı); plaka sütunundaki tekrar eden "Sefer: …" satırı kalktı.


### Düzeltildi: döküm satırı yazıları · Entegrasyonlar üst barı
- **Android: döküm satırını açıp kapatınca yazılar hâlâ kayboluyordu.** Asıl sebep: `overflow: 'hidden'` + gölgeli kutuda kenarlık
  kalınlığının değişmesi ve FlatList'in satır kırpması. Kenarlık artık hep aynı kalınlıkta (kapalıyken şeffaf), `overflow` yok,
  `removeClippedSubviews={false}`; detaydaki tek kenarlı kesikli çizgi düz çizgi oldu. Telefonda açıp kapatarak denendi.
- **Entegrasyonlar:** standart sarı uygulama başlığı açık (diğer ekranlar gibi); sayfa başlığı ve "← Geri" onun altında
  (önceden başlık gizliydi, bar durum çubuğuna yapışıyordu).


### "Fiş Kes ve Yazdır" → "Ekle"
- Sefer Gir ve Manuel Sefer pencerelerinde kaydet düğmesinin adı "Ekle" (`JobDetails`); davranış aynı (kaydeder, fiş penceresi açılır).


### "Firma Tanıtımları" → "Sektör Firmaları" · İşlerim kartında döküm kutusu
- Ana sayfa kartı (Supplier/DriverHome), firmalar listesi başlığı ve WebView yükleniyor metni "Sektör Firmaları". Ekran/route adları değişmedi.
- İşlerim kartındaki döküm özeti çerçeveli kutuda: "DÖKÜM" başlığı, Ort. tonaj / Toplam satırları, verisi alınamayan sefer notu kırmızı.


### Döküm ekranı sekmeli · satır yazıları kaybolmuyor
#### Değişti
- **İşlerim → Döküm (`DumpOverview`):** Web'deki gibi sekmeler: **Fişler** (özet kutuları, eşleşme filtresi, arama, liste),
  **Hesap** (Hesapta Kalan, para yatırma), **Yükle / İndir** (İSTAÇ'tan Çek, İSTAÇ/Cebeci Excel indir, Excel yükle). Eski "İndir / Yükle"
  menüsü ve listedeki "İSTAÇ'tan Çek" düğmesi bu sekmeye taşındı.
- İşlerim kartında "Ortalama tonaj" her zaman görünür; eşleşen döküm kaydı yoksa "-".
#### Düzeltildi
- **Android: döküm satırına dokunup açıp kapatınca satırlardaki yazılar kayboluyordu.** Satır `TouchableOpacity` yerine `Pressable`
  (gölgeli + `overflow: hidden` kutuda saydamlık animasyonu), liste açık satır/filtre/sekme değişince yeniden çiziliyor (`extraData`).
#### Uyumluluk
- API değişmedi; native değişiklik yok.


### Döküm listesi sade ve açılır · iş kartında döküm özeti · iOS döküm fişi kutusu
#### Değişti
- **İşlerim → Döküm (`DumpOverview`):** satıra dokununca detay açılır (`DumpRecordDetail`: kabul belgesi, toplam/dara/net, bedel, kart
  kodu, fiş no, çıkış, saha, yük tipi, ATS, operatör, eşleşen sefer). "Yükleme" sütunu iş + seri no, eşleşmeyende kırmızı "Bulunamadı".
  Ton sütunu ve Ortalama Tonaj dolu (brüt) ağırlık (eski API'de net). Eşleşme filtresi: Tümü / Eşleşen / Eşleşmeyen / Farklı plaka.
- **İşlerim kartı:** "Ortalama tonaj · Toplam döküm · (N seferin verisi alınamadı)" (`formatJobDumpSummary`; sadece döküm fişi girilmiş
  seferi olan işlerde).
#### Düzeltildi
- **iOS: Döküm fişi kutusu bazen dokunuşa cevap vermiyordu** (`DumpTicketInput`): yazı alanı tek satır yüksekliğindeydi, kutunun
  üstüne/altına dokunuş "klavyeyi kapat" alanına gidiyordu. Artık alan kutuyu kaplar, kutunun boş yerine dokunmak da odaklar.
#### Uyumluluk
- Gereken en düşük API: yeni alanlar için API 2026.10.28; eski API'de detayda sadece eski alanlar, kartta özet görünmez. Native değişiklik yok.

### İş içi tarih filtresi "Tüm zamanlar" · İş Notları Excel'i yine önizlemeyle açılır
#### Değişti
- **İş detayı (`JobDetails`):** sefer listesinin tarih filtresi varsayılan olarak **Tüm zamanlar** (önceden bu ay). Bir uç seçilince
  diğeri doldurulur (başlangıç → bitiş bugün; bitiş → başlangıç aynı gün), ✕ tüm zamanlara döner. Excel tarih boşken tüm seferleri indirir.
  Araç Yönetimi ve Döküm ekranları bu ay varsayılanıyla kaldı (`useDateRange({ defaultAllTime })`, `HaulSearchBar` "Tüm zamanlar").
- **İş Notları → Excel (iOS):** Paylaş penceresi yerine yine **önizleme** açılır (önce notlar penceresi kapanır, sonra önizleme);
  kaydet/gönder önizlemenin paylaş düğmesinden. Önizleme açılamazsa Paylaş penceresi. Android değişmedi.
#### Uyumluluk
- API değişmedi; native değişiklik yok, yerel veri değişmedi.

### İş Notları: "Mesai" düğmesi · "Sanal Fiş Kes" gizlendi
#### Eklendi
- **İş Notları (`JobNotesModal`):** 4. düğme "⏱ Mesai" (düğmeler 2×2). Basınca **Mesai Süresi** (serbest metin, zorunlu) ve
  **Açıklama** (isteğe bağlı) kutuları açılır. Listede "⏱ Mesai: 2 saat" rozeti; düzenlemede süre dolu gelir.
  API: `noteType: 3` + `overtimeDuration` (`jobSiteNewService`).
#### Değişti
- **Sefer Gir ve Manuel Sefer (`JobDetails`):** "Sanal Fiş Kes" düğmeleri gizlendi (`SHOW_VIRTUAL_RECEIPT = false`); sadece
  "Fiş Kes ve Yazdır" kalır. Sefer önce kaydedilir, yazdırma fiş penceresindeki "Yazdır" ile → yazıcısız da kayıt yapılabilir.
  Bundan sonra seferler `isPrintedReceipt: true` kaydedilir.
#### Uyumluluk
- Gereken en düşük API: mesai için API 2026.10.28 (`AddJobSiteNoteOvertime` migration'ı). Eski API'de mesai kaydı
  "Geçersiz kayıt tipi." hatası alır; diğer not türleri etkilenmez. Native değişiklik yok, yerel veri değişmedi.
> Mac'te yapılan (`faf4563a`) ile birleştirildi: İSTAÇ uyarısı ve Döküm'e geri dönüş aynen alındı; satır detayı bu
> sürümdeki `DumpRecordDetail` ile (Android yazı kaybolma düzeltmesi dahil), Mac'teki aynı işi yapan ikinci uygulama alınmadı.

### Döküm → İSTAÇ'tan Çek: bilgiler girilmemişse doğru uyarı
#### Düzeltildi
- **İSTAÇ kullanıcı adı/şifresi kayıtlı değilken "Bu özellik için sunucu güncellemesi gerekiyor." diyordu.** API bu durumda 404 + Türkçe mesaj
  ("Önce İSTAÇ kullanıcı adı ve şifresini kaydediniz.") döner; ekran her 404'ü "eski sunucu" sanıyordu. Artık mesajlı 404 ayrılıyor
  (`isIstacNotConfigured`, `dumpService.ts`): "İSTAÇ Bilgileri Gerekli" uyarısı + "Bilgileri Gir" → Entegrasyonlar. Uç hiç yoksa (gövdesiz 404) eski mesaj aynı.
- Döküm'den açılan Entegrasyonlar ekranında geri tuşu Profil'e gidiyordu; artık `from: 'Dump'` ile Döküm'e döner.
#### Eklendi
- **Döküm tablosunda satıra dokununca fiş detayı** (iOS + Android aynı kod; web'deki döküm listesiyle aynı): satırın altında açılır, tekrar
  dokununca kapanır. Kabul belgesi, toplam/dara/net kg, bedel, etiket/kart kodu/fiş no, çıkış saati, saha, yük tipi, ATS, operatör ve
  eşleşen sefer (plaka · iş, seri no, saat; farklı plaka kırmızı). `DumpRecord`'a opsiyonel detay alanları eklendi (API zaten döndürüyordu).
#### Uyumluluk
- API değişmedi; yerel veri değişmedi. Native değişiklik yok. Eski API detay alanlarını döndürmezse o satırlar gizlenir.

### İSTAÇ Entegrasyonları (Profil → Entegrasyonlar & Döküm → İSTAÇ'tan Çek)
#### Eklendi
- **Profil → Entegrasyonlar (`src/screens/supplier/IntegrationsScreen.tsx`):** Firma/araç sahipleri için İSTAÇ Hafriyat Online kullanıcı adı ve şifresini kaydetme, bağlantı durumunu ve son senkron bilgisini görme, "🔄 Şimdi Güncelle" ile güvenlik kodu girmeden (sunucuda Tesseract OCR ile otomatik çözülerek) tüm sahaların döküm verilerini çekme ve entegrasyonu silme ekranı.
- **İşlerim → Döküm (`src/screens/supplier/DumpOverview.tsx`):** Seçili tarih aralığı için tek dokunuşla "🔄 İSTAÇ'tan Çek" butonu (ve "İndir / Yükle" menüsünde "🔄 İSTAÇ'tan Çek (Otomatik)" seçeneği). Entegrasyon henüz tanımlı değilse doğrudan Entegrasyonlar ekranına yönlendirir.
#### Uyumluluk
- API: `GET/PUT/DELETE /Integrations/istac`, `POST /Integrations/istac/sync`. Eski sunucuda uç yoksa (404) "Bu özellik için sunucu güncellemesi gerekiyor." mesajı gösterilir; uygulama çökmez. Native değişiklik yok.

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
