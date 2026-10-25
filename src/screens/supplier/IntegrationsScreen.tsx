import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../../hooks';
import { getMyCompanies } from '../../services/userService';
import { getIstacIntegration, saveIstacIntegration, deleteIstacIntegration, syncIstac, isEndpointMissing, IstacIntegration, IstacSyncResult, formatIstacSyncSummary } from '../../services/dumpService';
import { formatDumpDateTime, isValidDDMMYYYY } from '../../utils/dumpFormat';
import { ddmmyyyyToYMD } from '../../utils/dateRange';

// ── Profil → Entegrasyonlar: İSTAÇ Hafriyat Online kullanıcı adı/şifre kaydı ve tek tıkla "Şimdi Güncelle" (Tesseract OCR + 5 deneme).
// Web'deki /Profile/Integrations sayfasıyla birebir aynı işlev ve kurallar.

export default function IntegrationsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const paramCompanyId: string | null = route.params?.companyId || null;
  const fromScreen: string | undefined = route.params?.from;

  const token = useAppSelector(state => state.auth.token);
  const reduxCompanyId = useAppSelector(state => state.auth.companyId || state.auth.user?.companyId || null);

  const [companyId, setCompanyId] = useState<string | null>(paramCompanyId || reduxCompanyId);
  const [loading, setLoading] = useState(true);
  const [notSupported, setNotSupported] = useState(false);
  const [istac, setIstac] = useState<IstacIntegration | null>(null);

  // Form alanları
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Şimdi Güncelle (senkron)
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<IstacSyncResult | null>(null);

  const errorMessage = (e: any, fallback: string): string => e?.response?.data?.errors?.[0] || e?.response?.data?.message || fallback;

  const resolveCompanyAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      let cid = paramCompanyId || reduxCompanyId;
      if (!cid && token) {
        const res = await getMyCompanies(token);
        const list = res?.data;
        const my = Array.isArray(list) ? list.find((c: any) => c.isOwner) || list[0] : list;
        if (my?.id) cid = String(my.id);
      }
      setCompanyId(cid || null);
      if (!cid) {
        setIstac(null);
        return;
      }
      const data = await getIstacIntegration(cid);
      setNotSupported(false);
      setIstac(data);
      setUsername(data.username || '');
      setPassword('');
      setIsActive(data.configured ? data.isActive : true);
    } catch (e: any) {
      if (isEndpointMissing(e)) {
        setNotSupported(true);
      } else {
        Alert.alert('Hata', errorMessage(e, 'Entegrasyon bilgisi alınamadı.'));
      }
    } finally {
      setLoading(false);
    }
  }, [paramCompanyId, reduxCompanyId, token]);

  useEffect(() => {
    resolveCompanyAndLoad();
  }, [resolveCompanyAndLoad]);

  const handleBack = () => {
    if (fromScreen === 'Dump') {
      navigation.goBack();
    } else {
      navigation.navigate('Profile');
    }
  };

  const handleSave = async () => {
    if (!companyId || saving) return;
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      Alert.alert('Eksik Bilgi', 'İSTAÇ kullanıcı adını giriniz.');
      return;
    }
    if (!istac?.hasPassword && !password) {
      Alert.alert('Eksik Bilgi', 'İSTAÇ şifresini giriniz.');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const updated = await saveIstacIntegration({
        companyId,
        username: trimmedUser,
        password: password ? password : undefined,
        isActive,
      });
      setIstac(updated);
      setUsername(updated.username || '');
      setPassword('');
      setIsActive(updated.isActive);
      Alert.alert('Başarılı', 'İSTAÇ bilgileri kaydedildi.');
    } catch (e: any) {
      Alert.alert('Hata', errorMessage(e, 'İSTAÇ bilgileri kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!companyId || deleting) return;
    Alert.alert('Bağlantıyı Sil', 'İSTAÇ bağlantısı silinsin mi? Daha önce çekilen döküm verileri silinmez.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteIstacIntegration(companyId);
            setIstac({
              companyId,
              configured: false,
              username: '',
              hasPassword: false,
              isActive: true,
            });
            setUsername('');
            setPassword('');
            setIsActive(true);
            setSyncResult(null);
            Alert.alert('Başarılı', 'İSTAÇ entegrasyonu silindi. Daha önce çekilen döküm verileri duruyor.');
          } catch (e: any) {
            Alert.alert('Hata', errorMessage(e, 'İSTAÇ entegrasyonu silinemedi.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleSyncNow = async () => {
    if (!companyId || syncing) return;
    const sText = startDateText.trim();
    const eText = endDateText.trim();
    if (sText && !isValidDDMMYYYY(sText)) {
      Alert.alert('Tarih Hatası', 'Başlangıç tarihini GG.AA.YYYY biçiminde girin (ör. 01.10.2026).');
      return;
    }
    if (eText && !isValidDDMMYYYY(eText)) {
      Alert.alert('Tarih Hatası', 'Bitiş tarihini GG.AA.YYYY biçiminde girin (ör. 25.10.2026).');
      return;
    }
    Keyboard.dismiss();
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncIstac({
        companyId,
        startDate: sText ? ddmmyyyyToYMD(sText) : undefined,
        endDate: eText ? ddmmyyyyToYMD(eText) : undefined,
      });
      setSyncResult(result);
      const refreshed = await getIstacIntegration(companyId);
      setIstac(refreshed);
      Alert.alert(result.hasErrors ? '⚠️ Tamamlandı' : '✅ İSTAÇ Güncellendi', formatIstacSyncSummary(result));
    } catch (e: any) {
      try {
        const refreshed = await getIstacIntegration(companyId);
        setIstac(refreshed);
      } catch {}
      Alert.alert('Bağlantı Hatası', errorMessage(e, 'İSTAÇ sistemine 5 denemede bağlanılamadı. Lütfen kullanıcı adı ve şifrenizi kontrol edip tekrar deneyiniz.'));
    } finally {
      setSyncing(false);
    }
  };

  const renderStatusBadge = () => {
    if (!istac?.configured) {
      return (
        <View style={[styles.statusBadge, styles.statusOff]}>
          <Text style={[styles.statusBadgeText, styles.statusOffText]}>Bağlı değil</Text>
        </View>
      );
    }
    if (!istac.isActive) {
      return (
        <View style={[styles.statusBadge, styles.statusOff]}>
          <Text style={[styles.statusBadgeText, styles.statusOffText]}>Pasif</Text>
        </View>
      );
    }
    if (istac.lastSyncSuccess === false) {
      return (
        <View style={[styles.statusBadge, styles.statusErr]}>
          <Text style={[styles.statusBadgeText, styles.statusErrText]}>Son güncelleme başarısız</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusOk]}>
        <Text style={[styles.statusBadgeText, styles.statusOkText]}>Bağlı</Text>
      </View>
    );
  };

  const lastSyncFormatted = istac?.lastSyncAt ? (() => {
    const dt = formatDumpDateTime(istac.lastSyncAt);
    return dt.time ? `${dt.date} ${dt.time}` : dt.date;
  })() : 'Henüz yapılmadı';

  const lastSyncedUntilFormatted = istac?.lastSyncedUntil ? formatDumpDateTime(istac.lastSyncedUntil).date : '-';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Üst başlık */}
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <TouchableOpacity style={styles.btnBack} onPress={handleBack} activeOpacity={0.8}>
            <Text style={styles.btnBackText}>← Geri</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarTitle}>🔌 Entegrasyonlar</Text>
            <Text style={styles.topBarSubtitle}>Dış sistem döküm bağlantıları</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD500" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : !companyId ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Entegrasyonlar için bir firmaya bağlı olmalısınız.</Text>
        </View>
      ) : notSupported ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Bu özellik için sunucu güncellemesi gerekiyor.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>♻️ İSTAÇ Hafriyat Online</Text>
              {renderStatusBadge()}
            </View>

            <Text style={styles.descText}>
              İSTAÇ kullanıcı adı ve şifrenizi bir kez kaydedin. "Şimdi Güncelle"ye bastığınızda güvenlik kodu otomatik çözülerek (en fazla 5 deneme) tüm hafriyat sahalarınızın günlük raporu çekilir ve Döküm ekranına eklenir. Şifreniz şifrelenerek saklanır ve hiçbir ekranda gösterilmez.
            </Text>

            {istac?.configured && (
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Son güncelleme:</Text>
                  <Text style={styles.metaValue}>{lastSyncFormatted}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Çekilen son gün:</Text>
                  <Text style={styles.metaValue}>{lastSyncedUntilFormatted}</Text>
                </View>
                {istac.lastSyncSuccess === false && !!istac.lastSyncError && (
                  <Text style={styles.metaError}>⚠️ {istac.lastSyncError}</Text>
                )}
              </View>
            )}

            {/* Senkron sonucu tablosu */}
            {syncResult && (
              <View style={[styles.resultBox, syncResult.hasErrors ? styles.resultBoxWarn : styles.resultBoxOk]}>
                <Text style={styles.resultSummary}>{formatIstacSyncSummary(syncResult)}</Text>
                {syncResult.sites.map(s => (
                  <View key={s.siteId || s.siteName} style={styles.siteRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.siteName}>{s.siteName}</Text>
                      {!!s.lastDataTime && <Text style={styles.siteTime}>Son veri: {s.lastDataTime}</Text>}
                      {!!s.error && <Text style={styles.siteError}>{s.error}</Text>}
                    </View>
                    <View style={styles.siteStats}>
                      <Text style={styles.siteStatText}>İSTAÇ: {s.reportedRows}</Text>
                      <Text style={styles.siteStatBold}>+{s.insertedRows} yeni</Text>
                      <Text style={styles.siteStatText}>{s.matchedRows} eşleşen</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Şimdi Güncelle bölümü (kayıtlı ve aktifse) */}
            {istac?.configured && istac.isActive && (
              <View style={styles.syncSection}>
                <Text style={styles.sectionTitle}>İSTAÇ'tan Veri Çek</Text>
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Başlangıç (opsiyonel)</Text>
                    <TextInput
                      style={styles.input}
                      value={startDateText}
                      onChangeText={setStartDateText}
                      placeholder="GG.AA.YYYY"
                      placeholderTextColor="#AAA"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bitiş (opsiyonel)</Text>
                    <TextInput
                      style={styles.input}
                      value={endDateText}
                      onChangeText={setEndDateText}
                      placeholder="GG.AA.YYYY"
                      placeholderTextColor="#AAA"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                </View>
                <Text style={styles.hintText}>
                  Boş bırakılırsa son güncellemenin birkaç gün öncesinden (ilk seferde yılbaşından) bugüne çekilir.
                </Text>
                <TouchableOpacity style={[styles.syncBtn, syncing && styles.btnDisabled]} onPress={handleSyncNow} disabled={syncing} activeOpacity={0.85}>
                  {syncing ? (
                    <View style={styles.btnLoadingRow}>
                      <ActivityIndicator size="small" color="#111" />
                      <Text style={styles.syncBtnText}>İSTAÇ'tan çekiliyor...</Text>
                    </View>
                  ) : (
                    <Text style={styles.syncBtnText}>🔄 Şimdi Güncelle</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider} />

            {/* Kullanıcı Adı / Şifre Formu */}
            <Text style={styles.sectionTitle}>{istac?.configured ? 'Giriş Bilgileri' : 'İSTAÇ Hesabını Bağla'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>İSTAÇ Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Kullanıcı adınızı yazın"
                placeholderTextColor="#AAA"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>İSTAÇ Şifresi</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={istac?.hasPassword ? 'Değiştirmek için yazın (kayıtlı)' : 'Şifrenizi yazın'}
                  placeholderTextColor="#AAA"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={200}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={styles.eyeBtnText}>{showPassword ? 'Gizle' : 'Göster'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Entegrasyon Aktif</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#CCC', true: '#FFD500' }}
                thumbColor={isActive ? '#111' : '#F4F3F4'}
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
            </TouchableOpacity>

            {istac?.configured && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.8}>
                {deleting ? <ActivityIndicator size="small" color="#C62828" /> : <Text style={styles.deleteBtnText}>🗑️ Bağlantıyı Sil</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F2F3' },
  topBar: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnBack: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: '#FAFAFA',
  },
  btnBackText: { fontSize: 14, fontWeight: '700', color: '#222' },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  topBarSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#555', textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusOk: { backgroundColor: '#E8F5E9' },
  statusOkText: { color: '#2E7D32' },
  statusErr: { backgroundColor: '#FFEBEE' },
  statusErrText: { color: '#C62828' },
  statusOff: { backgroundColor: '#F5F5F5' },
  statusOffText: { color: '#616161' },
  descText: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 12 },
  metaBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  metaValue: { fontSize: 13, color: '#111', fontWeight: '800' },
  metaError: { fontSize: 12.5, color: '#C62828', fontWeight: '700', marginTop: 6 },
  resultBox: { borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1 },
  resultBoxOk: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  resultBoxWarn: { backgroundColor: '#FFF8E1', borderColor: '#FFE082' },
  resultSummary: { fontSize: 13.5, fontWeight: '800', color: '#111', marginBottom: 8 },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  siteName: { fontSize: 13, fontWeight: '700', color: '#222' },
  siteTime: { fontSize: 11.5, color: '#666', marginTop: 1 },
  siteError: { fontSize: 11.5, color: '#C62828', fontWeight: '700', marginTop: 2 },
  siteStats: { alignItems: 'flex-end', marginLeft: 8 },
  siteStatText: { fontSize: 11.5, color: '#555', fontWeight: '600' },
  siteStatBold: { fontSize: 12.5, color: '#2E7D32', fontWeight: '800' },
  syncSection: {
    backgroundColor: '#FFFDF2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 10 },
  dateRow: { flexDirection: 'row', gap: 10 },
  hintText: { fontSize: 12, color: '#777', marginBottom: 10, lineHeight: 16 },
  syncBtn: {
    backgroundColor: '#FFD500',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncBtnText: { fontSize: 15, fontWeight: '900', color: '#111' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#555', marginBottom: 5 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CFCFCF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: '#111',
    marginBottom: 6,
  },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: '#F9F9F9',
  },
  eyeBtnText: { fontSize: 13, fontWeight: '700', color: '#333' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#222' },
  saveBtn: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  btnDisabled: { opacity: 0.6 },
  deleteBtn: { marginTop: 14, paddingVertical: 8, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#C62828' },
});
