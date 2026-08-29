import React, { useMemo, useState, useEffect } from 'react';
import TimePickerInput from './TimePickerInput';
import DatePickerInput from './DatePickerInput';
import { createJobSite, updateJobSite, getHaulsVisibility } from '../services/jobSiteNewService';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  TextInputProps,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { CITIES } from '../constants/cities';
import { DISTRICTS } from '../constants/districts';
import { useAppSelector } from '../hooks';

const YELLOW = '#FFD500';
const CARD_BG = '#fff';

type JobCategory = 'HAFRIYAT' | 'KUM_MICIR';

/* ================= TYPES ================= */

type Offer = {
  dumpLocation: string;
  cash: string;
  fuel: string;
  isVisible: boolean;
};

type Route = {
  loadLocation: string;
  unloadLocation: string;
  cashPerTon: string;
  material: string;
};

type AppInputProps = Omit<TextInputProps, 'onChangeText'> & {
  label?: string;
  flex?: boolean;
  height?: number;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
};

type CardProps = {
  title: string;
  children: React.ReactNode;
};

type NewJobModalProps = {
  onClose: (refresh?: boolean) => void;
  initialJob?: any;
};

type PickerItem = { label: string; value: any };
type PickerState = {
  visible: boolean;
  title: string;
  options: PickerItem[];
  onSelect: (value: any) => void;
};

/* ================= COMPONENT ================= */

export default function NewJobModal({ onClose, initialJob }: NewJobModalProps) {
  const insets = useSafeAreaInsets();

  const user = useAppSelector(state => state.auth.user);
  const companyId = useAppSelector(state => state.auth.companyId) || user?.companyId;
  const token = useAppSelector(state => state.auth.token);

  const [jobCategory, setJobCategory] = useState<JobCategory>('HAFRIYAT');
  const [nakliyeciOpen, setNakliyeciOpen] = useState(false);

  const [siteName, setSiteName] = useState('');
  const [provinceCode, setProvinceCode] = useState<number | null>(null);
  const [districtName, setDistrictName] = useState<string>('');
  const [locationUrl, setLocationUrl] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  const [description, setDescription] = useState('');
  const [signDescription, setSignDescription] = useState('');

  /* Hafriyat → Teklifler */
  const [offers, setOffers] = useState<Offer[]>([
    { dumpLocation: '', cash: '', fuel: '', isVisible: true },
  ]);

  /* Kum / Mıcır → Rotalar */
  const [routes, setRoutes] = useState<Route[]>([
    { loadLocation: '', unloadLocation: '', cashPerTon: '', material: '' },
  ]);

  const todayDDMMYYYY = (): string => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${now.getFullYear()}`;
  };

  const [sandDate, setSandDate] = useState<string>(todayDDMMYYYY());

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fuelStock, setFuelStock] = useState('');
  // isActive artık nakliyeciOpen'dan okunuyor (ayrı state yok)
  const [showHaulsToVehicleOwners, setShowHaulsToVehicleOwners] = useState(true);

  /* Picker modal state */
  const [pickerState, setPickerState] = useState<PickerState>({
    visible: false,
    title: '',
    options: [],
    onSelect: () => { },
  });

  const districts = useMemo(() => {
    if (!provinceCode) return [];
    return DISTRICTS[provinceCode] ?? [];
  }, [provinceCode]);

  const openPicker = (title: string, options: PickerItem[], onSelect: (value: any) => void) => {
    setPickerState({ visible: true, title, options, onSelect });
  };

  const closePicker = () => setPickerState(s => ({ ...s, visible: false }));

  // 🛠 EDİT MODU: Verileri doldur
  useEffect(() => {
    if (initialJob) {
      setSiteName(initialJob.name);
      setProvinceCode(initialJob.provinceCode);
      setDistrictName(initialJob.districtName);
      setLocationUrl(initialJob.locationUrl || '');
      setDescription(initialJob.description || '');
      setSignDescription(initialJob.signDescription || '');

      if (initialJob.contactPhone) {
        setPhones(initialJob.contactPhone.split(', '));
      }

      setFuelStock(String(initialJob.fuelStock || ''));
      setStartTime(initialJob.loadingStartTime || '');
      setEndTime(initialJob.loadingEndTime || '');
      // Yayında mı? → Nakliyeci Çağır açık/kapalı
      setNakliyeciOpen(initialJob.isActive === true);
      // API bu alanı henüz dönmüyor, AsyncStorage'dan oku
      getHaulsVisibility(initialJob.id).then(cached => {
        const apiValue = initialJob.isHaulVisibleToVehicleOwners ?? initialJob.showHaulsToVehicleOwners;
        const value = apiValue !== undefined ? apiValue : (cached !== undefined ? cached : true);
        console.log('[NewJobModal] edit open - id:', initialJob.id, '| apiValue:', apiValue, '| cached:', cached, '| final:', value);
        setShowHaulsToVehicleOwners(value);
      });

      const isKum = initialJob.jobType === 1;
      setJobCategory(isKum ? 'KUM_MICIR' : 'HAFRIYAT');

      if (isKum) {
        // KUM MICIR - all routes in extraOffersJson
        const newRoutes: Route[] = [];
        if (initialJob.extraOffersJson) {
          try {
            const parsed = JSON.parse(initialJob.extraOffersJson);
            // Yeni format: { date, routes: [...] }  |  Eski format: [...]
            const routeArray = Array.isArray(parsed) ? parsed : (parsed.routes ?? []);
            const parsedDate: string | undefined = !Array.isArray(parsed) ? parsed.date : undefined;
            if (parsedDate) setSandDate(parsedDate);
            routeArray.forEach((e: any) => {
              newRoutes.push({
                loadLocation: e.loading || e.Loading || '',
                unloadLocation: e.unloading || e.Unloading || '',
                cashPerTon: String(e.cash ?? e.cashPerTon ?? ''),
                material: e.material || e.Material || '',
              });
            });
          } catch { }
        }
        if (newRoutes.length === 0 && initialJob.offer1Name) {
          const parts = initialJob.offer1Name.split(' - ');
          newRoutes.push({
            loadLocation: parts[0] || '',
            unloadLocation: parts[1] || '',
            cashPerTon: String(initialJob.offer1Cash || ''),
            material: '',
          });
        }
        setRoutes(
          newRoutes.length > 0
            ? newRoutes
            : [{ loadLocation: '', unloadLocation: '', cashPerTon: '', material: '' }],
        );
      } else {
        // HAFRIYAT
        const newOffers: Offer[] = [];
        if (initialJob.extraOffersJson) {
          try {
            const parsed = JSON.parse(initialJob.extraOffersJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const hasIsVisible = 'isVisible' in parsed[0] || 'IsVisible' in parsed[0];
              if (hasIsVisible) {
                // New unified format
                parsed.forEach((o: any) => {
                  newOffers.push({
                    dumpLocation: o.name || o.Name || '',
                    cash: String(o.cash ?? ''),
                    fuel: String(o.fuel ?? ''),
                    isVisible: o.isVisible !== false && o.IsVisible !== false,
                  });
                });
              } else {
                // Old extras format
                if (initialJob.offer1Name) {
                  newOffers.push({
                    dumpLocation: initialJob.offer1Name,
                    cash: String(initialJob.offer1Cash || ''),
                    fuel: String(initialJob.offer1Fuel || ''),
                    isVisible: true,
                  });
                }
                parsed.forEach((e: any) => {
                  newOffers.push({
                    dumpLocation: e.dumpLocation || e.name || '',
                    cash: String(e.cash ?? ''),
                    fuel: String(e.fuel ?? ''),
                    isVisible: true,
                  });
                });
              }
            }
          } catch { }
        }
        // Fallback: only offer1Name, no extraOffersJson
        if (newOffers.length === 0 && initialJob.offer1Name) {
          newOffers.push({
            dumpLocation: initialJob.offer1Name,
            cash: String(initialJob.offer1Cash || ''),
            fuel: String(initialJob.offer1Fuel || ''),
            isVisible: true,
          });
        }
        setOffers(
          newOffers.length > 0
            ? newOffers
            : [{ dumpLocation: '', cash: '', fuel: '', isVisible: true }],
        );
      }
    }
  }, [initialJob]);

  /* ================= HELPERS ================= */

  const addOffer = () =>
    setOffers(o => [...o, { dumpLocation: '', cash: '', fuel: '', isVisible: true }]);

  const removeOffer = (i: number) =>
    setOffers(o => o.filter((_, idx) => idx !== i));

  const updateOffer = (i: number, key: keyof Offer, value: any) => {
    setOffers(o => {
      const clone = [...o];
      clone[i] = { ...clone[i], [key]: value };
      return clone;
    });
  };

  const addRoute = () =>
    setRoutes(r => [
      ...r,
      { loadLocation: '', unloadLocation: '', cashPerTon: '', material: '' },
    ]);

  const removeRoute = (i: number) =>
    setRoutes(r => r.filter((_, idx) => idx !== i));

  const updateRoute = (i: number, key: keyof Route, value: string) => {
    setRoutes(r => {
      const clone = [...r];
      clone[i] = { ...clone[i], [key]: value };
      return clone;
    });
  };

  const addPhone = () => setPhones(p => [...p, '']);
  const removePhone = (i: number) =>
    setPhones(p => p.filter((_, idx) => idx !== i));

  const updatePhone = (i: number, value: string) => {
    setPhones(p => {
      const clone = [...p];
      clone[i] = value;
      return clone;
    });
  };

  /* ================= PARSERS ================= */

  const toDecimalOrNull = (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const toIntOr0 = (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n);
  };

  /* ================= DIRTY CHECK ================= */

  const isDirty = useMemo(() => {
    if (!initialJob) return true;

    if (siteName !== initialJob.name) return true;
    if (provinceCode !== initialJob.provinceCode) return true;
    if (districtName !== initialJob.districtName) return true;
    if ((locationUrl || '') !== (initialJob.locationUrl || '')) return true;
    if ((description || '') !== (initialJob.description || '')) return true;
    if ((signDescription || '') !== (initialJob.signDescription || '')) return true;

    const currentPhones = phones.filter(p => p.trim() !== '').join(', ');
    if (currentPhones !== (initialJob.contactPhone || '')) return true;

    if (String(toIntOr0(fuelStock)) !== String(initialJob.fuelStock || 0)) return true;
    if ((startTime || '') !== (initialJob.loadingStartTime || '')) return true;
    if ((endTime || '') !== (initialJob.loadingEndTime || '')) return true;

    const isKum = jobCategory === 'KUM_MICIR';
    if (isKum !== (initialJob.jobType === 1)) return true;

    return true; // Always allow save (format may change)
  }, [
    siteName, provinceCode, districtName, locationUrl, description, signDescription,
    phones, fuelStock, startTime, endTime, jobCategory, offers, routes, sandDate, initialJob,
  ]);

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!companyId) {
      Alert.alert('Uyarı', 'Firma bilgisi alınamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    try {
      const contactPhonesString = phones.filter(p => p.trim() !== '').join(', ');
      const isKum = jobCategory === 'KUM_MICIR';

      let extraOffersJson: string | null = null;

      if (isKum) {
        if (routes.length > 0) {
          extraOffersJson = JSON.stringify(
            routes.map(r => ({
              loading: r.loadLocation,
              unloading: r.unloadLocation,
              cash: toDecimalOrNull(r.cashPerTon) ?? 0,
              material: r.material,
              price: 0,
              unit: '',
              ton: 0,
              type: 1,
            }))
          );
        }
      } else {
        // Hafriyat: unified JSON format (all offers with isVisible)
        if (offers.length > 0) {
          extraOffersJson = JSON.stringify(
            offers.map(o => ({
              name: o.dumpLocation,
              cash: toDecimalOrNull(o.cash) ?? 0,
              fuel: toDecimalOrNull(o.fuel) ?? 0,
              isVisible: o.isVisible !== false,
            })),
          );
        }
      }

      if (token) {
        // Ortak payload — hem CREATE hem UPDATE aynı yapı (camelCase)
        const contactPhoneArray = phones.filter(p => p.trim() !== '');
        const payload = {
          companyId,
          name: siteName,
          jobType: isKum ? 1 : 0,
          provinceCode: provinceCode ?? 0,
          districtName: districtName || '',
          locationUrl: locationUrl || '',
          description,
          signDescription,
          contactPhone: contactPhonesString,
          contactPhones: contactPhoneArray,
          fuelStock: isKum ? 0 : toIntOr0(fuelStock),
          extraOffersJson,
          offer1Name: null,
          offer1Cash: null,
          offer1Fuel: null,
          offer2Name: null,
          offer2Cash: null,
          offer2Fuel: null,
          hasFuel: false,
          fuelLiters: null,
          hasSand: false,
          sandFuelLiters: null,
          hasCash: false,
          cashAmount: null,
          loadingStartTime: startTime || null,
          loadingEndTime: endTime || null,
          isActive: nakliyeciOpen,
          isHaulVisibleToVehicleOwners: showHaulsToVehicleOwners,
        };

        if (initialJob) {
          console.log('[NewJobModal] UPDATE payload:', JSON.stringify(payload, null, 2));
          await updateJobSite(token, initialJob.id, payload);
          Alert.alert('Güncellendi', 'İş ilanı başarıyla güncellendi.', [
            { text: 'Tamam', onPress: () => onClose(true) },
          ]);
        } else {
          console.log('[NewJobModal] CREATE payload:', JSON.stringify(payload, null, 2));
          await createJobSite(token, payload);
          Alert.alert('Başarılı', 'İş ilanı başarıyla oluşturuldu.', [
            { text: 'Tamam', onPress: () => onClose(true) },
          ]);
        }
      } else {
        Alert.alert('Hata', 'Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.');
      }
    } catch (error) {
      console.error('Job save failed', error);
      Alert.alert('Hata', 'İş kaydedilirken bir sorun oluştu.');
    }
  };

  /* ================= RENDER ================= */

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => onClose()} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{initialJob ? 'İşi Düzenle' : 'Yeni İş Kur'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* İŞ TÜRÜ */}
        <View style={styles.categoryWrapper}>
          <TouchableOpacity
            style={[styles.categoryBtn, jobCategory === 'HAFRIYAT' && styles.categoryBtnActive]}
            onPress={() => setJobCategory('HAFRIYAT')}
            activeOpacity={0.85}
          >
            <Text style={jobCategory === 'HAFRIYAT' ? styles.categoryTextActive : styles.categoryText}>
              Hafriyat / Döküm
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryBtn, jobCategory === 'KUM_MICIR' && styles.categoryBtnActive]}
            onPress={() => setJobCategory('KUM_MICIR')}
            activeOpacity={0.85}
          >
            <Text style={jobCategory === 'KUM_MICIR' ? styles.categoryTextActive : styles.categoryText}>
              Kum / Mıcır
            </Text>
          </TouchableOpacity>
        </View>

        {/* TEMEL BİLGİLER — İş Adı + Teklifler/Rotalar */}
        <Card title="Temel Bilgiler">
          <AppInput
            label="İş Adı *"
            placeholder="Örn: Esenler TOKİ"
            value={siteName}
            onChangeText={setSiteName}
          />

          {/* KUM/MICIR → İŞ TARİHİ (İş Adı'nın hemen altı) */}
          {jobCategory === 'KUM_MICIR' && (
            <DatePickerInput
              label="İş Tarihi"
              value={sandDate}
              onChange={setSandDate}
            />
          )}

          {/* HAFRİYAT → TEKLİFLER */}
          {jobCategory === 'HAFRIYAT' && (
            <>
              <Text style={styles.subSectionTitle}>Teklifler</Text>
              {offers.map((o, i) => (
                <View key={i} style={styles.offerBox}>
                  <View style={styles.routeHeader}>
                    <Text style={styles.offerTitle}>Teklif {i + 1}</Text>
                    <View style={styles.offerHeaderRight}>
                      <TouchableOpacity
                        style={[styles.visibleBtn, o.isVisible && styles.visibleBtnActive]}
                        onPress={() => updateOffer(i, 'isVisible', !o.isVisible)}
                      >
                        <Text style={[styles.visibleBtnText, o.isVisible && styles.visibleBtnTextActive]}>
                          {o.isVisible ? '👁 Görünür' : '🚫 Gizli'}
                        </Text>
                      </TouchableOpacity>
                      {offers.length > 1 && (
                        <TouchableOpacity onPress={() => removeOffer(i)}>
                          <Text style={styles.delete}>Sil</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <AppInput
                    placeholder="Döküm yeri adı (örn: Cebeci)"
                    value={o.dumpLocation}
                    onChangeText={v => updateOffer(i, 'dumpLocation', v)}
                  />
                  <View style={styles.row}>
                    <AppInput
                      placeholder="Nakit ₺"
                      keyboardType="numeric"
                      value={o.cash}
                      onChangeText={v => updateOffer(i, 'cash', v)}
                      flex
                    />
                    <AppInput
                      placeholder="Yakıt Lt"
                      keyboardType="numeric"
                      value={o.fuel}
                      onChangeText={v => updateOffer(i, 'fuel', v)}
                      flex
                    />
                  </View>
                  <Text style={styles.hint}>Nakit veya yakıttan en az birini girin</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.addOfferBtn} onPress={addOffer}>
                <Text style={styles.addOfferText}>+ Teklif Ekle</Text>
              </TouchableOpacity>
            </>
          )}

          {/* KUM/MICIR → ROTALAR */}
          {jobCategory === 'KUM_MICIR' && (
            <>
              <Text style={styles.subSectionTitle}>Rotalar</Text>
              <Text style={styles.routeInfo}>
                Yükleme ve boşaltma noktalarını belirleyin. Her rota için ton fiyatı girebilirsiniz.
              </Text>
              {routes.map((r, i) => (
                <View key={i} style={styles.routeBox}>
                  <View style={styles.routeHeader}>
                    <Text style={styles.offerTitle}>Rota {i + 1}</Text>
                    {routes.length > 1 && (
                      <TouchableOpacity onPress={() => removeRoute(i)}>
                        <Text style={styles.delete}>Sil</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <AppInput
                    placeholder="Yükleme Yeri"
                    value={r.loadLocation}
                    onChangeText={v => updateRoute(i, 'loadLocation', v)}
                  />
                  <AppInput
                    placeholder="Boşaltma Yeri"
                    value={r.unloadLocation}
                    onChangeText={v => updateRoute(i, 'unloadLocation', v)}
                  />
                  <View style={styles.row}>
                    <AppInput
                      placeholder="Ton başına ₺"
                      keyboardType="numeric"
                      value={r.cashPerTon}
                      onChangeText={v => updateRoute(i, 'cashPerTon', v)}
                      flex
                    />
                    <AppInput
                      placeholder="Malzeme Cinsi"
                      value={r.material}
                      onChangeText={v => updateRoute(i, 'material', v)}
                      flex
                    />
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addOfferBtn} onPress={addRoute}>
                <Text style={styles.addOfferText}>+ Rota Ekle</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* NAKLİYECİ ÇAĞIR — Collapsible */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.nakliyeciHeader}
            onPress={() => setNakliyeciOpen(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>Nakliyeci Çağır</Text>
            <Text style={styles.nakliyeciChevron}>{nakliyeciOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {nakliyeciOpen && (
            <>
              {/* Konum */}
              <Text style={styles.label}>İl </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() =>
                  openPicker(
                    'İl Seçin',
                    CITIES.map(c => ({ label: c.label, value: c.value })),
                    value => {
                      setProvinceCode(value);
                      setDistrictName('');
                    },
                  )
                }
              >
                <Text style={{ color: provinceCode ? '#111' : '#8E8E93' }}>
                  {provinceCode ? CITIES.find(c => c.value === provinceCode)?.label : 'İl seçin'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>İlçe </Text>
              <TouchableOpacity
                style={[styles.input, !provinceCode && { opacity: 0.5 }]}
                disabled={!provinceCode}
                onPress={() =>
                  openPicker(
                    'İlçe Seçin',
                    districts.map(d => ({ label: d.label, value: d.value })),
                    value => setDistrictName(value),
                  )
                }
              >
                <Text style={{ color: districtName ? '#111' : '#8E8E93' }}>
                  {districtName || 'İlçe seçin'}
                </Text>
              </TouchableOpacity>

              <AppInput
                label="Konum Linki"
                placeholder="Google Maps linki"
                value={locationUrl}
                onChangeText={setLocationUrl}
              />

              <Text style={styles.label}>İrtibat Telefonları </Text>
              {phones.map((p, i) => (
                <View key={i} style={styles.phoneRow}>
                  <AppInput
                    placeholder="05xx xxx xx xx"
                    keyboardType="phone-pad"
                    value={p}
                    onChangeText={v => updatePhone(i, v)}
                    flex
                  />
                  {phones.length > 1 && (
                    <TouchableOpacity onPress={() => removePhone(i)}>
                      <Text style={styles.delete}>Sil</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity onPress={addPhone}>
                <Text style={styles.addText}>+ Telefon Ekle</Text>
              </TouchableOpacity>

              <AppInput
                label="Tabela Açıklaması"
                placeholder="Kısa tabela açıklaması (max 100 karakter)"
                value={signDescription}
                onChangeText={setSignDescription}
                error={signDescription.length > 100 ? `Tabela açıklaması 100 karakterden fazla olamaz (${signDescription.length}/100)` : undefined}
              />

              <AppInput
                label="Açıklama"
                placeholder="Ek bilgiler (opsiyonel)"
                value={description}
                onChangeText={setDescription}
                multiline
                height={110}
              />
            </>
          )}
        </View>

        {/* Çalışma Saatleri — her zaman görünür */}
        <Card title="Çalışma Saatleri">
          <View style={styles.row}>
            <TimePickerInput
              placeholder="Başlangıç(09:00)"
              value={startTime}
              onChange={setStartTime}
              flex
            />
            <TimePickerInput
              placeholder="Bitiş (18:00)"
              value={endTime}
              onChange={setEndTime}
              flex
            />
          </View>
          <Text style={styles.hint}>Şantiyenin çalışma saat aralığı</Text>
        </Card>

        {/* Ayarlar — her zaman görünür */}
        <Card title="Ayarlar">
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setShowHaulsToVehicleOwners(v => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Seferleri Araç Sahiplerine Göster</Text>
              <Text style={styles.toggleHint}>Açık olduğunda araç sahipleri sadece kendi plakalarına yazılan seferi görürler.</Text>
            </View>
            <View style={[styles.togglePill, showHaulsToVehicleOwners && styles.togglePillOn]}>
              <View style={[styles.toggleThumb, showHaulsToVehicleOwners && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
          {!showHaulsToVehicleOwners && (
            <Text style={styles.toggleNote}>
              Kapatırsanız bundan sonra kesilen fişler araç sahiplerine görünmez
            </Text>
          )}
        </Card>

        {/* Yakıt Stoku — sadece Hafriyat/Döküm */}
        {jobCategory === 'HAFRIYAT' && (
          <Card title="Yakıt Stoku">
            <AppInput
              placeholder="Şantiyedeki toplam yakıt (Litre)"
              keyboardType="numeric"
              value={fuelStock}
              onChangeText={setFuelStock}
            />
            <Text style={styles.hint}>Şantiyede bulunan toplam yakıt miktarı</Text>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => onClose()}>
          <Text>Vazgeç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, (!isDirty || signDescription.length > 100) && { backgroundColor: '#ccc' }]}
          onPress={handleSave}
          disabled={!isDirty || signDescription.length > 100}
        >
          <Text style={{ fontWeight: '800' }}>{initialJob ? 'Güncelle' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>

      {/* PICKER MODAL */}
      <Modal
        visible={pickerState.visible}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerState.title}</Text>
              <TouchableOpacity onPress={closePicker} style={styles.pickerCloseBtn}>
                <Text style={styles.pickerCloseText}>İptal</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerState.options}
              keyExtractor={item => String(item.value)}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    pickerState.onSelect(item.value);
                    closePicker();
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ================= UI HELPERS ================= */

const Card = ({ title, children }: CardProps) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const AppInput = ({
  label,
  flex,
  height,
  onChangeText,
  placeholder,
  error,
  ...props
}: AppInputProps) => (
  <View style={{ flex: flex ? 1 : undefined }}>
    {label && <Text style={styles.label}>{label}</Text>}
    <TextInput
      {...props}
      placeholder={placeholder}
      placeholderTextColor="#8E8E93"
      onChangeText={onChangeText}
      style={[
        styles.input,
        height ? { height, textAlignVertical: 'top', paddingTop: 12 } : undefined,
        error ? { borderColor: '#D32F2F', borderWidth: 1.5, backgroundColor: '#FFF5F5' } : undefined,
      ]}
    />
    {!!error && <Text style={styles.inputError}>{error}</Text>}
  </View>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F3F3F3' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#fff',
    elevation: 4,
    borderBottomWidth: 1,
    borderColor: '#f2f2f2',
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  back: { fontSize: 22 },
  headerTitle: { fontWeight: '800', fontSize: 16 },

  container: { padding: 14 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    elevation: 3,
  },
  cardTitle: { fontWeight: '800', marginBottom: 10, fontSize: 18 },

  nakliyeciHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  nakliyeciChevron: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
  },
  subSectionTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: '#444',
    marginTop: 12,
    marginBottom: 6,
  },

  label: { fontSize: 15, color: '#666', marginTop: 10, marginBottom: 6 },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
    color: '#111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputError: {
    color: '#D32F2F', fontSize: 12, marginTop: -8, marginBottom: 8, marginLeft: 4,
  },

  row: { flexDirection: 'row', gap: 10 },

  offerBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  routeBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },

  offerTitle: { fontWeight: '800', fontSize: 16 },

  offerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  visibleBtn: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  visibleBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  visibleBtnText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  visibleBtnTextActive: {
    color: '#2E7D32',
  },

  addText: { color: '#666', fontSize: 14, marginTop: 4 },

  addOfferBtn: {
    borderWidth: 1,
    borderColor: YELLOW,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addOfferText: { fontWeight: '800', fontSize: 15 },

  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  delete: { color: '#E53935', fontSize: 13, fontWeight: '700' },

  hint: { fontSize: 12, color: '#999', marginTop: 3, marginBottom: 6 },

  routeInfo: { fontSize: 12, color: '#777', marginBottom: 10 },

  categoryWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },
  categoryBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  categoryBtnActive: { backgroundColor: YELLOW },
  categoryText: { color: '#666', fontWeight: '700' },
  categoryTextActive: { color: '#111', fontWeight: '900' },

  footer: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#fff',
    gap: 15,
    borderTopWidth: 1,
    borderColor: '#f2f2f2',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#eee',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  /* Picker modal */
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  pickerTitle: { fontWeight: '800', fontSize: 16 },
  pickerCloseBtn: { padding: 4 },
  pickerCloseText: { color: '#E53935', fontWeight: '700', fontSize: 15 },
  pickerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pickerItemText: {
    fontSize: 15,
    color: '#111',
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleInfo: { flex: 1, paddingRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  toggleHint: { fontSize: 12, color: '#888', marginTop: 2 },
  toggleDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 2 },

  togglePill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D0D0D0',
    justifyContent: 'center',
    padding: 2,
  },
  togglePillOn: { backgroundColor: YELLOW },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleNote: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 6,
    marginHorizontal: 2,
  },
});
