# Uyumluluk Kuralları — Mobil

> **Ana kural:** Yayındaki hiçbir şey bozulmaz. Mağazadaki eski sürümler, Web ve API her güncellemeden sonra aynen çalışır.

Ortak kuralların tamamı backend reposunda: `C:\Users\MARHAN\source\repos\rojhatmarhan\HafriyApp\docs\UYUMLULUK.md`
Plan (yol haritası): `C:\Users\MARHAN\source\repos\rojhatmarhan\HafriyApp\docs\YOL-HARITASI.md`
Bu dosya mobil tarafa özel noktaları özetler.

## Neden?
API değişiklikleri anında herkese gider; mobil güncellemeleri ise kullanıcı güncelleyene kadar gitmez. iOS'ta zorunlu
güncelleme olmadığı için eski sürümler aylarca sahada kalır. Bu yüzden:
- **API her zaman en eski mobil sürümle de çalışmalı** (API'yi değiştiren backend kurallarına uyar).
- **Yeni mobil sürüm, eski API ile de çökmemeli** (mobil yayın API'den önce çıkabilir veya API geri alınabilir).

## Mobil kuralları
1. **Yeni API alanları opsiyoneldir.** `item.dumpFee ?? null`, `item.isPinned === true` gibi okunur; alan yoksa eski davranış sürer.
2. **Yeni uç yoksa sessizce eski davranışa dön.** Yeni bir uç 404 dönerse (API henüz yayınlanmamış) ekran çökmez, özellik gizlenir.
3. **Mevcut istek gövdeleri değiştirilmez, sadece alan eklenir.** Alan adı/tipi değiştirilmez.
4. **Sürüm başlıkları:** Her istek `X-App-Platform`, `X-App-Version`, `X-App-Build` gönderir (`src/services/api.ts`). API bir davranışı sadece
   yeni sürümlere uygulamak isterse bu başlığa bakar. Bu başlıkları kaldırmayın, değiştirmeyin.
5. **Yerel veri (AsyncStorage / Keychain / redux-persist):** Anahtar veya biçim değişirse eski biçim okunup bir kez dönüştürülür, silinmez
   (ör. `pinned_chat_groups` → sunucuya taşınırken). `redux-persist` state'ine alan eklerken varsayılan değer verin; `version`/`migrate` gerekiyorsa ekleyin.
6. **Native değişiklik = yeni mağaza sürümü.** Yeni native paket, izin (Info.plist / AndroidManifest), patch güncellemesi CHANGELOG'da
   "Native" başlığıyla yazılır; iOS için `pod install` gerektiği belirtilir.
7. **Sürüm numarası her mağaza yüklemesinde artar:** Android `versionCode` +1 (`android/app/build.gradle`), iOS `CURRENT_PROJECT_VERSION` +1.
   `versionName` / `MARKETING_VERSION` özellik sürümünde artar. Mevcut: Android 1.7.2 (17), iOS 1.0.7 (14).
8. **Hata mesajı API'den gelir:** `errors[0]` veya `message` gösterilir; yeni hata metinleri mobilde sabitlenmez.

## Her değişiklik için kontrol listesi
- [ ] Yeni API alanı/ucu yokken ekran çalışıyor mu?
- [ ] Yerel kayıt biçimi değişti mi? Eski kayıt dönüştürülüyor mu?
- [ ] Native değişiklik var mı? (yeni sürüm + pod install notu)
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` geçiyor mu?
- [ ] `CHANGELOG.md` güncellendi mi? Gerekli en düşük API sürümü yazıldı mı?
