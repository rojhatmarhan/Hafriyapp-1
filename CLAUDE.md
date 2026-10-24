# HafriyApp Mobil — React Native

Hafriyat (toprak taşıma) sektörü uygulaması. Firma/araç sahipleri şantiye açar, sefer (fiş) keser, araç ve şoför yönetir;
şoförler iş ilanlarını görür ve kendi seferlerini takip eder. Pazar (iş/araç ilanları) ve grup sohbeti içerir.
UI metinleri, hata mesajları ve kod yorumları **Türkçe**.

- **Platform:** iOS + Android — React Native 0.82.1, React 19.1, TypeScript
- **Paket:** Android `com.hafriyapp` · iOS `com.Hafriyapp`
- **Backend:** ayrı repo — `C:\Users\MARHAN\source\repos\rojhatmarhan\HafriyApp` (.NET 8 API + Razor Web). API davranışı için oradaki `CLAUDE.md`'ye bak.
- Kurulum, çalıştırma ve yayın adımları: [README.md](README.md)

## ⚠️ Altın kural: yayındaki hiçbir şey bozulmaz
Değişiklik yapmadan önce [docs/UYUMLULUK.md](docs/UYUMLULUK.md) oku, yaptıktan sonra [CHANGELOG.md](CHANGELOG.md)'ye yaz.
Plan ve iş durumu backend reposundaki `docs/YOL-HARITASI.md`'de. Kısaca:
- Mağazadaki eski sürümler aylarca kalır → API değişiklikleri sadece **ekleme**; yeni mobil, yeni API alanlarını **opsiyonel** okur.
- Yeni uç/alan yoksa ekran çökmez, özellik gizlenir.
- Yerel veri biçimi değişirse eski kayıt dönüştürülür, silinmez.
- Native değişiklik = yeni mağaza sürümü (`versionCode` / `CURRENT_PROJECT_VERSION` +1).
- Kullanıcı istemedikçe commit atılmaz.

## Stack
| Alan | Kütüphane |
|------|-----------|
| Navigasyon | React Navigation 7 (native-stack + drawer + bottom-tabs) |
| State | Redux Toolkit + redux-persist (AsyncStorage) |
| HTTP | Axios (`src/services/api.ts`) |
| Token | react-native-keychain (`src/utils/secureStore.ts`) |
| Real-time | @microsoft/signalr (`CompanyChat.tsx`) |
| Push | @react-native-firebase/messaging |
| Yazıcı | react-native-bluetooth-escpos-printer (patch'li) |
| Plaka okuma | @react-native-ml-kit/text-recognition + react-native-camera-kit (patch'li) |
| QR | react-native-qrcode-svg, react-native-camera-kit |
| Fiş görüntüsü | react-native-view-shot |
| Mağaza güncellemesi | sp-react-native-in-app-updates |
| Dosya seçici (Döküm Excel yükleme) | @react-native-documents/picker 12.0.2 (native → iOS'ta `pod install`) |
| Yazı tipi (Firma tanıtımı) | Barlow / Barlow Condensed — `assets/fonts/`, `react-native-asset` ile bağlı (`fontFamily: 'Barlow-SemiBold'`, `fontWeight` yok) |

`patches/` klasöründeki yamalar `npm install` sonrası `patch-package` ile otomatik uygulanır — bu kütüphaneleri güncellerken yamayı da güncelle.

## Klasör yapısı (`src/`)
```
services/     API çağrıları (her alan için bir dosya) — api.ts axios instance
screens/      Auth/, driver/, supplier/, common/ (WebView ekranları), showcase/ (Firma tanıtımı) + Profile, MyAds
navigation/   RootNavigator → AuthNavigator | AppNavigator(Drawer) → BottomTabs (role göre)
components/   Modal'lar (NewJobModal, JobNotesModal, BluetoothPrinterModal, PlateScannerModal, QRScannerModal...), ProvinceMultiSelect, TagIcon, CustomHeader
store/        authSlice, pendingHaulSlice (offline sefer kuyruğu), uiSlice, counterSlice (kullanılmıyor)
hooks/        useAuthBootstrap (keychain → redux), useAppDispatch/Selector, useStickySearch (sadece arama satırı sabit)
utils/        secureStore, jobMapper (pazar ilanı mapping), jobSiteMapper
constants/    cities (81 il; İstanbul 340 Avrupa / 341 Anadolu), districts
api/authApi.ts  ESKİ sahte OTP — kullanılmıyor, gerçek akış services/authService.ts
```

## API bağlantısı
- `src/services/api.ts`: `__DEV__` ise `http://localhost:5062`, değilse `https://api.hafriyapp.com`; `API_BASE_URL = BASE_HOST + '/api'`.
- İstek interceptor'ı token'ı keychain'den okuyup `Authorization: Bearer` ekler. Bazı servisler token'ı ayrıca parametre olarak da alır (eski stil).
- Cevap formatı backend `Result<T>`: `{ isSuccess, data, errors: string[] }`. Ekranlar hata mesajını `e.response.data.errors[0]` ile gösterir — **backend'den gelen Türkçe mesajlar doğrudan kullanıcıya gösterilir**, yeni hata durumlarında mesajı backend'de yaz.
- JSON casing: backend camelCase döner ama bazı eski kodlar iki casing'i de kontrol eder (`h.IsVisibleToVehicleOwner ?? h.isVisibleToVehicleOwner`).
- Resim URL'leri: `IMAGE_BASE` birkaç ekranda ayrı tanımlı (bazıları `BASE_HOST`, bazıları sabit `https://api.hafriyapp.com`).
- SignalR: `CompanyChat.tsx` → `${BASE_HOST}/hubs/chat`. (Backend'de mobil için ayrı `/hubs/mobile-chat` da var, token query string ile.)
- WebView ekranları: `WebToolScreen` (Döküm Excel'i web'den yükleme yedeği), `CompanyShowcase` (`https://hafriyapp.com/firma-tanitimi`, Hostinger'daki deneme sayfası). Ana sayfadaki "Firma Tanıtımları" kartı artık native `ShowcaseList`'i açar; API'de `/Showcase` yoksa (404) `CompanyShowcase` WebView'ına döner. Yan menüdeki "EK UYGULAMALAR" kaldırıldı.
- `UPLOADS_HOST` her zaman canlı (`https://api.hafriyapp.com`). Firma tanıtımı görselleri `showcaseImageUrl()` ile `BASE_HOST`'a göre çözülür (debug'da yerel API).

## Giriş akışı
1. `SelectRoleScreen` → rol: `driver` (UserType 0) / `supplier` (UserType 1)
2. `LoginScreen` → `POST /Auth/login` `{ phoneNumber: '+9' + '05XXXXXXXXX' }` (= `+905...`, doğru) veya `POST /Auth/register`
3. `OtpScreen` → 6 haneli kod, 120 sn tekrar gönder sayacı → `POST /Auth/verify-sms` → token + userType + companyId
4. Token keychain'e (`hafriyapp.auth`) ve Redux'a yazılır. `RootNavigator` 3 dakikada bir profili çeker: `accessMode === 1` (Blocked) → çıkış; `2` (Limited) → uyarı bandı. 401 → çıkış.
- Kod SMS ile gelir; uygulama API cevabındaki `verificationCode` alanını **kullanmaz** (backend yayında bu alanı boş döner).
- Backend SMS sınırları: aynı numaraya 60 sn'de bir, günde 5 kod, 5 hatalı denemede kod iptal → HTTP 429 + Türkçe mesaj (Alert'te gösterilir).

## Roller ve ekranlar
- **driver** tabs: DriverHome, DriverAllJobs, MarketAds, DriverJobs
- **supplier** tabs: SupplierHome (sohbet grupları), SupplierAllJobs, MarketAds, MyJobs (şantiyeler → JobDetails)
- Drawer: Anasayfa, Profil, İlanlarım, WebTool, CompanyChat/CompanyDetails/CompanyEdit/ProfileEdit (gizli rotalar)
- En büyük dosyalar (dikkatli düzenle): `JobDetails.tsx` (~4400 satır — şantiye detayı, sefer kesme, fiş, yazdırma, offline kuyruk), `SupplierVehicles.tsx` (~3000), `CompanyChat.tsx` (~1850), `MyAds.tsx`, `AllJobs.tsx` (driver ve supplier'da neredeyse aynı kopya), `NewJobModal.tsx` (~1100).

## Önemli iş kuralları
- **Sefer (Haul):** `POST /Haul` — `paymentType` 0 Nakit / 1 Yakıt / 2 İkisi, `timeOfHaul` ISO UTC. Hafriyat modunda tonaj alanı yok (0 gönderilir). İki buton: "Sanal Fiş Kes" (`isPrintedReceipt=false`) ve "Fiş Kes ve Yazdır" (`true`). Şantiyede görünürlük kapalıysa backend sanal fişe izin vermez.
- **Offline kuyruk:** Sefer gönderilemezse `pendingHaulSlice`'a (persist) yazılır. `JobDetails.syncPending` ekran açılınca, uygulama ön plana gelince (AppState `active`) ve senkron bandına basınca kuyruğu gönderir. `clientUniqueId` gönderiliyor ama backend kullanmıyor; mükerrer kaydı backend aynı şantiye+plaka+tonaj+±5 sn kuralıyla engeller — tekrar gönderim güvenli.
- **Seri No:** API'den `serialNumber` geldiyse onu göster; yoksa `yyMMdd + id'nin ilk 4 karakteri`. Tıklayınca kopyalanır.
- **İş notları:** `JobNotesModal` (tek Modal; düzenleme aynı ekranda — iOS'ta Modal üstüne Modal açılmaz, açmayın). Yetki: not bazında `canManage`.
- **Sohbet:** grup listesi sayfalı (20'şer, kaydırdıkça), mesajlar `before` cursor ile geriye yüklenir, yazı boyutu sabit (16/kalın). Sabitleme sunucuda (`isPinned`, `POST /ChatGroup/{id}/pin`); eski yerel `pinned_chat_groups` bir kez taşınır.
- **Döküm fişi:** seferde `dumpTicketNo` (ayrı alan, QR ile). Eski kayıtlarda numara `note` içinde olabilir — arama ve QR eşleştirme ikisine de bakar.
- **İş detayı filtresi:** tarih aralığı (`rangeStart`/`rangeEnd`, DD.MM.YYYY, varsayılan bu ayın tamamı) + arama; filtreleme istemcide.
- **İş sabitleme:** `GET /JobSite` → `isPinned`, `POST /JobSite/{id}/pin`; sıralamayı mobil yapar (sunucu sırası değişmez).
- **Fiş tasarımı** web ile aynı olmalı (`JobDetails` + `SupplierVehicles`): logo, firma/şantiye adı, Tarih/Seri No/Plaka/Şoför/Döküm/Ücret/Yetkili satırları, sağda QR.
- **Yazdırma:** `printService.ts` — fiş `view-shot` ile görüntü alınır, 384 px genişlikte ESC/POS Bluetooth yazıcıya basılır. Backend'de yazıcı MAC adresi `AuthorizedPrinter` ile yetkilendirilir.
- **Şantiye payload'ı:** CREATE PascalCase, UPDATE camelCase gönderiliyor (backend iki türlü de kabul ediyor) — `NewJobModal.tsx`. `JobType` 0 Hafriyat / 1 Kum-Mıcır; teklifler `ExtraOffersJson` (3 legacy format var, `jobMapper.ts` hepsini parse eder). Pazar listesinde `isVisible:false` teklifler gizlenir, şantiye sahibinin `JobDetails` görünümünde gösterilir (kasıtlı).
- **İlan tipleri:** 0 Araç Kiralama, 1 Tır Pazarı, 2 Şoför İlanı.
- **Plaka:** TR formatı `^(01-81)([A-Z]{1,3})([0-9]{2,4})$` (`PlateScannerModal`).

## Son eklenen özellikler (2026-10-24, ayrıntı: CHANGELOG.md)
- **Firma tanıtımı** (`src/screens/showcase/`, servis `src/services/showcaseService.ts`, yardımcılar `src/utils/showcaseFormat.ts`):
  liste, firma sayfası, Firmanı tanıt formu (8 fotoğraf yuvası) + önizleme, fiyat listesi. Tasarım hafriyapp.com/firma-tanitimi ile
  **birebir** (renkler `showcase/theme.ts`; ayrıntılı döküm backend `docs/FIRMA-TANITIMI-SPEC.md`, plan `docs/FIRMA-TANITIMI-PLAN.md`).
  Hikayeler, yorum/puan, PDF paylaşım, teklif hazırla sonraki fazlar (kodda `TODO Faz 3/4/5`). Düzenle sadece sayfanın sahibine.
- **Döküm** (İşlerim → "Döküm" sekmesi, `src/screens/supplier/DumpOverview.tsx`, `src/services/dumpService.ts`): özet kartları,
  Hesapta Kalan + para yatırma, "İSTAÇ Dökümleri / Cebeci Dökümü indir" (döküm sahasının kendi Excel biçimi), telefondan Excel yükleme.
- **Arayüz**: sayfa başlıkları listeyle kayar, sadece arama satırı sabit (`useStickySearch`; pencere < 500 dp ise o da kayar).
  Pazar kategori kartları `src/components/MarketCategoryPicker.tsx` (dikeyde alt alta ekranı doldurur).

## Mac'te / iOS'ta devam ederken
1. `git pull` → `npm install` (patch-package yamaları otomatik uygulanır) → `cd ios && pod install` (yeni: documents picker).
2. Xcode'da `ios/Hafriyapp.xcworkspace`. Barlow yazı tipleri `Info.plist` `UIAppFonts` + Copy Bundle Resources'ta; görünmezse
   `npx react-native-asset` tekrar çalıştırılabilir (`ios/link-assets-manifest.json` duruyor).
3. Debug derleme `http://localhost:5062`'ye gider; Mac'te yerel API çalışmıyorsa canlıya karşı denemek için **Release** şeması kullan.
4. Mağaza öncesi: `CURRENT_PROJECT_VERSION` / `versionCode` +1. Önce API yayınlanmalı (yeni uçlar); API eskiyse yeni ekranlar
   kendini gizler / WebView'a döner, çökmez.
5. `android/gradle.properties`: Windows makinesinde yerel `org.gradle.java.home` satırı var, **commit edilmez** (Mac'te gerekmez).
6. Kamera yaması (`patches/react-native-camera-kit+18.0.1.patch`) sadece iOS düzeltmelerini (`CameraView.swift`,
   `PhotoCaptureDelegate.swift`, `RealCamera.swift`) içerir; içine `android/build` çıktısı girmesin (`npx patch-package` öncesi build klasörünü temizle).

## Stil
Sarı `#FFD500`, siyah `#000`, arka plan `#F3F2F3`, kenarlık `#CFCFCF`, yazı gri `#555/#AAA`; buton radius 12-14, tab bar 80 px.
Prettier: tek tırnak, `printWidth: 999` (satır bölme yok), trailing comma, 2 boşluk.

## Kontrol komutları
```bash
npx tsc --noEmit     # tip kontrolü
npm run lint
npm test             # __tests__/ (jest; 18 dosya, 163 test — showcase, döküm, tarih, sticky arama, Pazar kartları...)
```

## Bilinen borçlar
- `src/services/api.ts` interceptor'ı token'ı `console.log` ile yazıyor — release'de log'a düşmemeli.
- Android `closedRelease` build type'ı `signingConfigs.release` kullanıyor, tanımlı `closedRelease` imzası kullanılmıyor. Keystore bulunamazsa release **debug keystore ile sessizce imzalanır** — mağazaya yüklemeden önce kontrol et.
- Debug'da `localhost:5062`: Android cihaz/emülatörde `adb reverse tcp:5062 tcp:5062` gerekir.
- `counterSlice` kullanılmıyor ama persist ediliyor; `api/authApi.ts`, `screens/HomeScreen.tsx`, `screens/supplier/MyJobs2.tsx` eski/yedek.
- `driver/AllJobs.tsx` ve `supplier/AllJobs.tsx` birebir kopya; `IMAGE_BASE` tekrarları.
- `useNavigation<any>()` yaygın; navigation param tipleri `types/navigation.d.ts`'de eksik.

## Bu repodaki Claude komutları
`.claude/commands` ve `.claude/agents` altında: `/plan`, `/write-plan`, `/execute-plan`, `/verify`, `/code-review`, `/build-fix`, `/brainstorm`, `/tdd`, `/gsd:*`. UI araması: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<sorgu>" --stack react-native`.
