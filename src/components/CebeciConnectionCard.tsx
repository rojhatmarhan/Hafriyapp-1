import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Keyboard } from 'react-native';
import CalendarDateButton from './CalendarDateButton';
import { getCebeci, connectCebeci, disconnectCebeci, requestCebeciData, CebeciConnection } from '../services/dumpService';
import { formatCebeciLastData, buildCebeciRequestRange, CebeciRequestMode } from '../utils/dumpFormat';
import { todayDDMMYYYY } from '../utils/dateRange';

// ── Döküm → Yükle / İndir: Cebeci döküm bağlantısı kartı (api/Cebeci).
// Dört durum: notConnected (kayıt formu) · pending · active (son veri, veri talebi, bağlantıyı kes) · disconnectPending.
// Eski API'de uç yok (404) ya da yetki yok → kart hiç gösterilmez. Talep adresi kullanıcıya gösterilmez.
// Tarih seçimi kartın içinde (CalendarDateButton kendi Modal'ını açar; bu kart Modal içinde değil → iOS'ta üst üste Modal yok).

type Props = { companyId: string; reloadKey?: number; title?: string };

const errText = (e: any, fallback: string): string => e?.response?.data?.errors?.[0] || e?.response?.data?.message || fallback;

const MODES: [CebeciRequestMode, string][] = [
  ['today', 'Bugün'],
  ['day', 'Tek gün'],
  ['range', 'Tarih aralığı'],
];

export default function CebeciConnectionCard({ companyId, reloadKey = 0, title }: Props) {
  const [conn, setConn] = useState<CebeciConnection | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kayıt formu
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  // Veri talebi
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<CebeciRequestMode>('today');
  const [day, setDay] = useState(todayDDMMYYYY);
  const [start, setStart] = useState(todayDDMMYYYY);
  const [end, setEnd] = useState(todayDDMMYYYY);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [lockedUntilTomorrow, setLockedUntilTomorrow] = useState(false);

  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqRef.current;
    try {
      const c = await getCebeci(companyId);
      if (reqId !== reqRef.current) return;
      setConn(c);
      setHidden(false);
    } catch {
      // 404 (eski API), 403 (yetki yok) ya da ağ hatası → kart gösterilmez; yenilemede tekrar denenir
      if (reqId !== reqRef.current) return;
      setHidden(true);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (hidden || (!conn && !loading)) return null;
  if (!conn) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#FFD500" />
      </View>
    );
  }

  const save = async () => {
    if (busy) return;
    const mail = email.trim();
    const company = name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Cebeci'de kayıtlı mail adresinizi tam yazın (ör. firma@ornek.com).");
      return;
    }
    Keyboard.dismiss();
    setError(null);
    setBusy(true);
    try {
      const res = await connectCebeci({ companyId, companyEmail: mail, companyName: company });
      setConn(res);
      if (res.status === 'active') Alert.alert('Cebeci', 'Cebeci bağlantınız aktif. Veriler geldikçe Döküm ekranında görünecek.');
      else if (res.status === 'pending') Alert.alert('Cebeci', 'Kaydınız alındı, kısa süre içinde aktif edilecek.');
    } catch (e: any) {
      setError(errText(e, 'Kaydedilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    Alert.alert('Bağlantıyı kes', 'Bağlantı kesilince Cebeci verileri gelmez; daha önce gelen fişler silinmez. Kesilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Bağlantıyı kes',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await disconnectCebeci(companyId);
            setConn(res);
            if (res.status === 'notConnected') Alert.alert('Cebeci', 'Cebeci bağlantısı kesildi.');
            else if (res.status === 'disconnectPending') Alert.alert('Cebeci', 'Bağlantı kesme talebiniz alındı.');
            setPickerOpen(false);
            setRequestMsg(null);
          } catch (e: any) {
            Alert.alert('Hata', errText(e, 'Bağlantı kesilemedi.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const sendRequest = async () => {
    if (busy) return;
    const range = buildCebeciRequestRange(mode, day, start, end);
    if (range.error) {
      setError(range.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await requestCebeciData({ companyId, startDate: range.startDate, endDate: range.endDate });
      setRequestMsg(res.mesaj || 'Talebiniz gönderildi.');
      if (res.sonraki === 'yarin') setLockedUntilTomorrow(true);
      setPickerOpen(false);
      load();
    } catch (e: any) {
      setRequestMsg(null);
      setError(errText(e, 'Talep gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const requestDisabled = busy || !conn.canRequestData || conn.manualRequestUsedToday || lockedUntilTomorrow;

  const dateField = (label: string, value: string, onChange: (v: string) => void) => (
    <View style={styles.dateField}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.dateValue}>{value}</Text>
      </View>
      <CalendarDateButton value={value} onChange={onChange} title={label} accessibilityLabel={`${label} seç`} />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title || 'Cebeci Döküm Bağlantısı'}</Text>
        {conn.status !== 'notConnected' && !!conn.statusName && (
          <View style={[styles.badge, conn.status === 'active' ? styles.badgeOk : styles.badgeWait]}>
            <Text style={[styles.badgeText, conn.status === 'active' ? styles.badgeOkText : styles.badgeWaitText]}>{conn.statusName}</Text>
          </View>
        )}
      </View>

      {conn.status === 'notConnected' && (
        <>
          <Text style={styles.desc}>Cebeci'den gelen döküm fişleriniz otomatik olarak buraya düşer. Cebeci'de kayıtlı mail adresinizi yazıp Kaydet'e basın; Cebeci'ye ayrıca bir şey bildirmeniz gerekmez. Kayıttan sonra veriler her gün otomatik gelir.</Text>
          <Text style={styles.fieldLabel}>Cebeci'de kayıtlı mail adresiniz</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="firma@ornek.com" placeholderTextColor="#AAA" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" maxLength={200} />
          <Text style={styles.fieldLabel}>Cebeci'deki firma adınız (isteğe bağlı)</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Boşsa firma adınız kullanılır" placeholderTextColor="#AAA" maxLength={200} />
          <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={save} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.primaryText}>Kaydet</Text>}
          </TouchableOpacity>
        </>
      )}

      {(conn.status === 'pending' || conn.status === 'disconnectPending') && (
        <>
          <Text style={styles.statusText}>{conn.status === 'pending' ? 'Kaydınız alındı, kısa süre içinde aktif edilecek.' : 'Bağlantı kesme talebiniz alındı.'}</Text>
          {!!conn.companyEmail && <Text style={styles.meta}>Mail: {conn.companyEmail}</Text>}
          {!!conn.companyName && <Text style={styles.meta}>Firma: {conn.companyName}</Text>}
        </>
      )}

      {conn.status === 'active' && (
        <>
          <Text style={styles.statusText}>{formatCebeciLastData(conn.lastDataAt)}</Text>
          {!!conn.companyName && <Text style={styles.meta}>Firma: {conn.companyName}</Text>}

          {pickerOpen ? (
            <View style={styles.pickerBox}>
              <View style={styles.segment}>
                {MODES.map(([key, label]) => (
                  <TouchableOpacity key={key} style={[styles.segItem, mode === key && styles.segItemActive]} onPress={() => setMode(key)} activeOpacity={0.8} accessibilityState={{ selected: mode === key }}>
                    <Text style={[styles.segText, mode === key && styles.segTextActive]} numberOfLines={1}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {mode === 'day' && dateField('Gün', day, setDay)}
              {mode === 'range' && (
                <>
                  {dateField('Başlangıç', start, setStart)}
                  {dateField('Bitiş', end, setEnd)}
                </>
              )}
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.secondaryBtn, styles.flex1]} onPress={() => setPickerOpen(false)} disabled={busy} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.flex1, busy && styles.disabled]} onPress={sendRequest} disabled={busy} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.primaryText}>Talebi gönder</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.flex1, requestDisabled && styles.disabled]}
                onPress={() => {
                  setError(null);
                  setPickerOpen(true);
                }}
                disabled={requestDisabled}
                activeOpacity={0.85}>
                <Text style={styles.primaryText}>Veri talep et</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtn, styles.flex1, busy && styles.disabled]} onPress={disconnect} disabled={busy} activeOpacity={0.85}>
                <Text style={styles.dangerText}>Bağlantıyı kes</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.note}>Günde bir kez elle veri talep edebilirsiniz.</Text>
          <Text style={styles.note}>Cevap süresi Cebeci'ye bağlıdır, birkaç dakika ile birkaç saat arasında sürebilir.</Text>
        </>
      )}

      {!!requestMsg && <Text style={styles.requestMsg}>{requestMsg}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: '900', color: '#111' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOk: { backgroundColor: '#E8F5E9' },
  badgeWait: { backgroundColor: '#FFF3B0' },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  badgeOkText: { color: '#1B5E20' },
  badgeWaitText: { color: '#6D4C00' },
  desc: { fontSize: 12.5, color: '#555', lineHeight: 18, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: '#111', marginBottom: 10 },
  statusText: { fontSize: 14, fontWeight: '800', color: '#222', marginBottom: 4 },
  meta: { fontSize: 12.5, color: '#666', marginBottom: 2 },
  note: { fontSize: 11.5, color: '#888', marginTop: 6, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  flex1: { flex: 1 },
  primaryBtn: { backgroundColor: '#FFD500', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 14, fontWeight: '900', color: '#111' },
  secondaryBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#CFCFCF', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700', color: '#222' },
  dangerBtn: { backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1.5, borderColor: '#EF9A9A', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontSize: 14, fontWeight: '800', color: '#C62828' },
  disabled: { opacity: 0.5 },
  pickerBox: { marginTop: 10, backgroundColor: '#F6F5F2', borderRadius: 12, padding: 10 },
  segment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', padding: 3, marginBottom: 8 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segItemActive: { backgroundColor: '#FFD500' },
  segText: { fontSize: 13, fontWeight: '700', color: '#555' },
  segTextActive: { color: '#111', fontWeight: '900' },
  dateField: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', paddingVertical: 6, paddingLeft: 12, paddingRight: 6, marginBottom: 6 },
  dateValue: { fontSize: 15, fontWeight: '800', color: '#111' },
  requestMsg: { fontSize: 13, fontWeight: '700', color: '#1B5E20', backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, marginTop: 10 },
  error: { fontSize: 13, color: '#C62828', fontWeight: '700', marginTop: 8 },
});
