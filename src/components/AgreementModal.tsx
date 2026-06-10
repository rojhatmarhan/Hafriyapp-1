import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';

const KVKK_TEXT = `HafriyApp – KİŞİSEL VERİLERİN KORUNMASI KANUNU KAPSAMINDA AYDINLATMA METNİ

Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla hareket eden FAST YAZILIM tarafından hazırlanmıştır.

1. Veri Sorumlusu
Veri Sorumlusu: FAST YAZILIM
E-posta: info@hafriyapp.com
Adres: Fast Yazılım, Türkiye

2. İşlenen Kişisel Veriler
HafriyApp uygulaması kapsamında aşağıdaki kişisel verileriniz işlenmektedir:
• Kimlik bilgileri: Ad, soyad, kullanıcı adı
• İletişim bilgileri: E-posta adresi, telefon numarası
• Firma bilgileri: Firma adı, unvanı, faaliyet bilgileri
• İşlem verileri: Sefer kayıtları, yükleme/boşaltma bilgileri, iş ilanları
• Teknik veriler: IP adresi, cihaz bilgisi, uygulama kullanım verileri
• Konum verileri: Sefer takibine ilişkin konum bilgileri (izin verilmesi halinde)
• İçerik moderasyon verileri: Kural ihlali nedeniyle raporlanan veya kaldırılan içerikler

3. Kişisel Verilerin İşlenme Amaçları
• Kullanıcı hesabının oluşturulması ve yönetimi
• Hafriyat firmalarına ait sefer kayıtlarının tutulması
• Herkese açık sohbet ve iş ilanı özelliklerinin sunulması
• Uygulama güvenliğinin sağlanması ve doğrulama işlemleri
• İçerik moderasyonu ve topluluk kurallarının uygulanması
• Kural ihlali yapan hesapların tespiti ve gerektiğinde kapatılması
• Yasal yükümlülüklerin yerine getirilmesi
• Müşteri destek hizmetlerinin sağlanması

4. Hukuki Sebepler
• KVKK Madde 5/2-a: Kanunlarda açıkça öngörülmesi
• KVKK Madde 5/2-c: Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması
• KVKK Madde 5/2-f: Veri sorumlusunun meşru menfaatlerinin korunması
• KVKK Madde 5/1: Açık rızanız (konum ve analitik veriler için)

5. Kişisel Verilerin Aktarılması
FAST YAZILIM, kişisel verilerinizi yurt içinde ve yurt dışında aşağıdaki taraflara aktarabilir:
• Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşları
• Hizmet alınan bulut ve altyapı sağlayıcıları
• Ödeme ve analiz hizmeti sağlayıcıları
Yurt dışı aktarımlarda KVKK'nın 9. maddesi kapsamındaki güvenceler sağlanmaktadır.

6. Saklama Süreleri
• Kullanıcı hesap verileri: Hesap silinene kadar + 3 yıl
• Sefer kayıtları: 5 yıl (ticari kayıt zorunluluğu)
• Teknik log kayıtları: 2 yıl
• İçerik moderasyon kayıtları: 3 yıl
• Hukuki uyuşmazlık durumlarında: Dava süresince

7. İlgili Kişinin Hakları (KVKK Madde 11)
• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenmişse buna ilişkin bilgi talep etme
• İşlenme amacını ve buna uygun kullanılıp kullanılmadığını öğrenme
• Verilerin aktarıldığı üçüncü kişileri bilme
• Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme
• Şartlar çerçevesinde verilerin silinmesini veya yok edilmesini isteme
• Aleyhine bir sonucun ortaya çıkmasına idiraz etme
• Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme

8. Başvuru
Başvurularınız FAST YAZILIM tarafından en geç 30 gün içinde sonuçlandırılacaktır. info@hafriyapp.com adresine e-posta veya FAST YAZILIM adresine yazılı başvuru yapabilirsiniz. Cevabın yetersiz bulunması halinde Kişisel Verileri Koruma Kurumu'na şikayette bulunabilirsiniz.`;

const EULA_TEXT = `HafriyApp – KULLANICI SÖZLEŞMESİ (EULA – SON KULLANICI LİSANS SÖZLEŞMESİ)

Bu Kullanıcı Sözleşmesi , FAST YAZILIM ile HafriyApp uygulamasını kullanan gerçek veya tüzel kişiler ("Kullanıcı") arasında akdedilmektedir. Uygulamayı indirerek, kurarak veya ilk kez kullanarak bu Sözleşme'yi okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.

1. Taraflar ve Konu
İşbu Sözleşme, FAST YAZILIM tarafından geliştirilen ve işletilen HafriyApp mobil uygulamasının kullanım koşullarını düzenlemektedir.

2. Hizmetin Tanımı
HafriyApp aşağıdaki hizmetleri sunar:

• Firmaya özel herkese açık sohbet alanı (iş ilanları, yükleme/boşaltma bilgileri)

• Sefer kayıt ve takip sistemi

• Hafriyatçılar arası bilgi paylaşım platformu

3. Kayıt, Hesap ve Şartların Kabulü
• Uygulamayı kullanmak için geçerli bir hesap oluşturmanız gerekmektedir.

• Kayıt sırasında veya ilk girişte bu Sözleşme'yi kabul etmeniz zorunludur; kabul etmeyenler uygulamayı kullanamazlar.

• Sağladığınız bilgilerin doğru ve güncel olması sizin sorumluluğunuzdadır.

• Hesap güvenliğinden ve şifrenizin gizliliğinden siz sorumlusunuz.

• Hesabınızın yetkisiz kullanımını derhal bize bildirmeniz gerekmektedir.

• 18 yaşından küçük bireyler uygulamayı kullanamaz.

4. Yasaklı İçerik ve Davranışlar
Bu uygulamada nefret söylemi, taciz, pornografik içerik, şiddet içerikleri ve spam kesinlikle yasaktır.

Kullanıcılar aşağıdaki davranışlardan kaçınmakla yükümlüdür:

• Nefret söylemi: Irk, etnik köken, din, cinsiyet, engellilik veya cinsel yönelim temelinde kişi ya da gruplara yönelik aşağılayıcı, küçük düşürücü veya düşmanca ifadeler kullanmak

• Taciz: Başka kullanıcıları tehdit etmek, korkutmak, rahatsız etmek veya sürekli hedef almak

• Pornografik içerik: Her türlü müstehcen, cinsel içerikli görsel veya metin paylaşmak

• Şiddet içerikleri: Şiddeti teşvik eden, yücelten veya gerçekleştirmeye teşvik eden paylaşımlar yapmak

• Spam: Tekrarlayan, gereksiz, ticari amaçlı veya yanıltıcı içerik yaymak

• Yasadışı içerik: Suç teşkil eden, yasalara aykırı veya üçüncü kişilerin haklarını ihlal eden paylaşımlar yapmak

• Kimlik avı / dolandırıcılık: Başkalarını kandırmaya yönelik sahte bilgi veya içerik paylaşmak

5. Kural İhlalinin Sonuçları
Kuralları ihlal eden kullanıcıların hesapları, önceden bildirim yapılmaksızın askıya alınabilir veya kalıcı olarak kapatılabilir.

FAST YAZILIM, ihlal niteliğine göre aşağıdaki tedbirleri uygulama hakkını saklı tutar:

• İçeriğin kaldırılması veya gizlenmesi

• Hesabın geçici olarak askıya alınması

• Hesabın kalıcı olarak kapatılması

• Gerekli hallerde yetkili makamlarla bilgi paylaşılması

Kullanıcılar, kural ihlali gerekçesiyle hesaplarına yapılan işlemlere itiraz etmek için en geç 30 gün içinde şirketle iletişime geçebilir.

6. Herkese Açık Sohbet Alanı
Sohbet alanında paylaşılan içerikler tüm kullanıcılara açık olup kamuya mal olmuş sayılır. Paylaştığınız içeriklerden hukuki ve cezai açıdan siz sorumlusunuz.

7. Sefer Kayıtları
Uygulamada oluşturduğunuz sefer kayıtları size aittir. Bu kayıtların doğruluğu ve eksiksizliği sizin sorumluluğunuzdadır. Resmi belgeler yerine geçmez.

8. Fikri Mülkiyet
Uygulama ve içeriğine ilişkin tüm fikri mülkiyet hakları FAST YAZILIM'a aittir. Kullanıcı içerikleri için sınırlı, devredilemez bir kullanım lisansı verilmektedir.

Kullanıcı, uygulamayı kopyalamayı, tersine mühendislik yapmayı veya türev ürün oluşturmayı kabul etmez.

9. Hizmet Değişiklikleri
FAST YAZILIM, bakım, güncelleme veya teknik nedenlerle hizmeti geçici olarak durdurabilir ya da bu Sözleşme'yi değiştirebilir. Değişiklikler uygulama içinden duyurulacaktır.

10. Sorumluluk Sınırlaması
FAST YAZILIM, kullanıcı içeriklerinden, sefer kayıtlarındaki hatalardan, hizmet kesintilerinden veya dolaylı zararlardan sorumlu tutulamaz.

11. Uygulanacak Hukuk
Bu Sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir.

12. İletişim ve İtiraz
FAST YAZILIM — info@hafriyapp.com

Adres: Fast Yazılım, Türkiye

Kural ihlali bildirimi veya hesap işlemlerine itiraz için yukarıdaki e-posta adresine yazabilirsiniz.`;

const PRIVACY_POLICY_TEXT = `HafriyApp – GİZLİLİK POLİTİKASI

Bu Gizlilik Politikası, FAST YAZILIM tarafından geliştirilen HafriyApp mobil uygulamasının kullanımı sırasında toplanan kişisel verilerin nasıl işlendiğini açıklamaktadır.

1. Toplanan Veriler
• Hesap Bilgileri: Ad, soyad, e-posta, şifre (şifrelenmiş), telefon numarası

• Firma Profili: Firma adı, faaliyet alanı, iletişim bilgileri

• Kullanıcı İçeriği: Herkese açık sohbette paylaşılan mesajlar ve iş ilanları

• Sefer Verileri: Araç plakaları, yükleme/boşaltma noktaları, tarih-saat bilgileri

• Cihaz Verileri: Cihaz modeli, işletim sistemi, uygulama sürümü

• Kullanım Verileri: Oturum süreleri, kullanılan özellikler

• Moderasyon Verileri: Kural ihlali şüphesiyle raporlanan içerikler ve işlem geçmişi

2. Verilerin Kullanım Amaçları
• Uygulamanın temel işlevlerini sunmak (sefer kaydı, sohbet, iş ilanları)

• Hesap doğrulama ve güvenlik

• Topluluk kurallarının uygulanması ve içerik moderasyonu

• Taciz, nefret söylemi, spam ve yasadışı içeriklerin tespiti ve kaldırılması

• Uygulama performansını iyileştirme

• Teknik sorunları tespit etme ve giderme

• Yasal yükümlülüklere uyum

3. Herkese Açık İçerik
HafriyApp'da sohbet alanında paylaşılan mesajlar, iş ilanları ve sefer duyuruları niteliği gereği tüm kullanıcılara açıktır. Bu alanlara paylaştığınız bilgilerin kamuya açık olduğunu kabul edersiniz.

4. İçerik Moderasyonu ve Veri İşleme
Bu uygulama; nefret söylemi, taciz, pornografik içerik, şiddet içerikleri ve spam barındıran iletişimlere izin vermez.

Bu tür ihlallerin tespiti amacıyla içerikler otomatik veya manuel olarak incelenebilir. Kural ihlali tespit edilen hesaplara ait veriler, hesap askıya alma veya kapatma işlemleri için işlenebilir ve saklı tutulabilir.

5. Veri Güvenliği
FAST YAZILIM verilerinizi korumak için endüstri standardı güvenlik önlemleri uygulamaktadır:

• SSL/TLS şifrelemesi ile veri iletimi

• Şifrelenmiş veritabanı depolama

• Düzenli güvenlik testleri ve güncellemeleri

• Erişim yetkilendirme ve kimlik doğrulama sistemleri

6. Üçüncü Taraf Hizmetler
• Google Firebase (analitik, bildirimler, kimlik doğrulama)

• Google Play Services / Apple App Store (uygulama dağıtımı)

• Bulut altyapı sağlayıcıları (sunucu hizmetleri)

Bu hizmetlerin kendi gizlilik politikaları geçerlidir.

7. Çocukların Gizliliği
HafriyApp 18 yaşın altındaki bireylere yönelik değildir. Bilerek 18 yaşından küçük kullanıcılara ait veri toplamayız.

8. Haklarınız
• Verilerinize erişim ve kopyasını talep etme

• Yanlış verilerin düzeltilmesini isteme

• Belirli koşullarda verilerinizin silinmesini talep etme

• İşlemeye itiraz etme hakkı

• Veri taşınabilirliği talep etme

Talepleriniz için: info@hafriyapp.com — FAST YAZILIM

9. Politika Değişiklikleri
Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikler uygulama içi bildirim veya e-posta yoluyla duyurulacaktır.`;

interface AgreementModalProps {
  visible: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({
  visible,
  onClose,
  url,
  title,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const fetchContent = async () => {
    if (!url) return;
    if (url.includes('kvkk-aydinlatma-metni') || title.includes('KVKK')) {
      setContent(KVKK_TEXT);
      setLoading(false);
      setError(false);
      return;
    }
    if (url.includes('kullanici-sozlesmesi') || title.includes('Sözleşme') || title.includes('EULA')) {
      setContent(EULA_TEXT);
      setLoading(false);
      setError(false);
      return;
    }
    if (url.includes('gizlilik-politikasi') || title.includes('Gizlilik') || title.includes('Privacy')) {
      setContent(PRIVACY_POLICY_TEXT);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parsedText = cleanHtmlToText(html);
      setContent(parsedText);
    } catch (e) {
      console.log('Error fetching agreement content:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchContent();
    } else {
      setContent('');
    }
  }, [visible, url]);

  const cleanHtmlToText = (html: string): string => {
    let mainContent = html;
    
    // Try to isolate the main post/article content to avoid menus/footers
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      mainContent = articleMatch[1];
    } else {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch) {
        mainContent = mainMatch[1];
      } else {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          mainContent = bodyMatch[1];
        }
      }
    }

    // Strip scripts and styles
    mainContent = mainContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
    mainContent = mainContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
    
    // Convert basic text tags to formatting/newlines
    mainContent = mainContent.replace(/<\/p>/gi, '\n\n');
    mainContent = mainContent.replace(/<\/div>/gi, '\n');
    mainContent = mainContent.replace(/<br\s*\/?>/gi, '\n');
    mainContent = mainContent.replace(/<\/li>/gi, '\n');
    mainContent = mainContent.replace(/<li[^>]*>/gi, ' • ');
    mainContent = mainContent.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n$1\n\n');

    // Remove all remaining tags
    let text = mainContent.replace(/<[^>]+>/g, '');

    // Decode standard HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&bull;/g, '•')
      .replace(/&ndash;/g, '-')
      .replace(/&mdash;/g, '—')
      .replace(/&ccedil;/g, 'ç')
      .replace(/&Ccedil;/g, 'Ç')
      .replace(/&ouml;/g, 'ö')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Uuml;/g, 'Ü');

    // Normalize whitespace and newlines
    text = text.replace(/\n\s+\n/g, '\n\n');
    text = text.replace(/ +/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#FFD500" />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Yazı yüklenirken bir hata oluştu.</Text>
              <TouchableOpacity onPress={fetchContent} style={styles.retryButton}>
                <Text style={styles.retryText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.text}>{content}</Text>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F2F3',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CFCFCF',
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    fontWeight: '400',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#555',
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AgreementModal;
