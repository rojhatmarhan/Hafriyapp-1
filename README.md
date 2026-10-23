# HafriyApp Mobil

Hafriyat (toprak taşıma) sektörü için iOS + Android uygulaması. Firma/araç sahipleri şantiye açar, sefer fişi keser ve
Bluetooth yazıcıdan basar; şoförler iş ilanlarını ve kendi seferlerini görür. React Native 0.82 + TypeScript.

- **Backend (API + Web):** ayrı repo, `.NET 8` — canlı API `https://api.hafriyapp.com`, web `https://hafriyapp.com`
- **Mimari, iş kuralları, bilinen sorunlar:** [CLAUDE.md](CLAUDE.md) (hem Claude hem geliştiriciler için proje rehberi)

## Gereksinimler
- Node.js ≥ 20, npm
- Android: Android Studio, JDK 17, Android SDK
- iOS (sadece macOS): Xcode, Ruby + Bundler, CocoaPods
- React Native ortam kurulumu: https://reactnative.dev/docs/set-up-your-environment

## Kurulum
```bash
npm install          # postinstall: patch-package, patches/ altındaki yamaları uygular
```
iOS için (macOS):
```bash
bundle install
cd ios && bundle exec pod install && cd ..
```

## Çalıştırma
```bash
npm start            # Metro
npm run android
npm run ios
```

### Hangi API'ye bağlanır?
`src/services/api.ts`:
- **Debug (`__DEV__`)** → `http://localhost:5062` (local backend). Backend'i `dotnet run --project HafriyApp.API` ile başlat.
  - Android cihaz/emülatörde localhost için: `adb reverse tcp:5062 tcp:5062`
  - iOS simülatörde ek ayar gerekmez; gerçek iPhone'da bilgisayarın IP'sini kullanman gerekir.
- **Release** → `https://api.hafriyapp.com` (canlı)

Local backend yoksa debug'da canlı API'yi denemek için `BASE_HOST`'u geçici olarak değiştir, **commit etme**.

### Giriş
Telefon + SMS kodu. Local backend Development modunda SMS göndermez; kod backend konsoluna yazılır ve API cevabında döner.
SMS sınırları (canlıda): aynı numaraya 60 sn'de bir, günde 5 kod.

## Kontrol
```bash
npx tsc --noEmit     # tip kontrolü
npm run lint
npm test
```

## Yayın (release)
Sürüm numaraları:
- Android: `android/app/build.gradle` → `versionCode` (her yüklemede +1), `versionName`
- iOS: Xcode → `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` (build numarası)

### Android
İmza bilgileri repoda **yok**: `android/keystore.properties` (gitignore'da) ve `.keystore` dosyası proje sahibinden alınır.
`keystore.properties` anahtarları: `MYAPP_RELEASE_STORE_FILE`, `MYAPP_RELEASE_KEY_ALIAS`, `MYAPP_RELEASE_STORE_PASSWORD`, `MYAPP_RELEASE_KEY_PASSWORD`
(+ `MYAPP_CLOSED_*` kapalı test için).
```bash
cd android
./gradlew bundleRelease      # Play Store için .aab → android/app/build/outputs/bundle/release/
./gradlew assembleRelease    # .apk
```
> ⚠️ Keystore bulunamazsa build **debug anahtarıyla** imzalanır ve Play Store reddeder. Yüklemeden önce imzayı kontrol et.

### iOS
Xcode'da `ios/Hafriyapp.xcworkspace` → Product → Archive → App Store Connect'e yükle.

Çıktılar `builds/` (gitignore) ve `build_releases/` altında tarih klasörlerinde tutulur.

## Firebase
Push bildirimi için `android/app/google-services.json` ve `ios/Hafriyapp/GoogleService-Info.plist` repoda. Giriş sonrası FCM token'ı
`POST /api/Notification/device-token` ile backend'e kaydedilir.

## Kurallar
- UI metinleri ve hata mesajları Türkçe. Kullanıcıya gösterilen hata mesajı mümkünse backend'den gelir (`errors[0]`).
- Kod stili Prettier'a göre (`.prettierrc.js`): tek tırnak, satır bölme yok.
- `patches/` altındaki yamalı kütüphaneleri (bluetooth yazıcı, camera-kit) güncellerken yamayı yeniden üret: `npx patch-package <paket>`.
- Fiş tasarımı web ile birebir aynı tutulur (`JobDetails.tsx`, `SupplierVehicles.tsx`).
