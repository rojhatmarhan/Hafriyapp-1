import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, FlatList, ActivityIndicator, InputAccessoryView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getJobSiteNotes, createJobSiteNote, updateJobSiteNote, deleteJobSiteNote, JobSiteNoteItem } from '../services/jobSiteNewService';

// Not tipleri (backend JobSiteNoteType): 0 Genel Not, 1 Mazot Verildi, 2 Gider
type NoteKind = 'note' | 'fuel' | 'expense';

const KIND_TO_TYPE: Record<NoteKind, number> = { note: 0, fuel: 1, expense: 2 };
const typeToKind = (t: number): NoteKind => (t === 1 ? 'fuel' : t === 2 ? 'expense' : 'note');

const KIND_META: Record<NoteKind, { button: string; title: string; amountLabel: string; amountPlaceholder: string; descLabel: string; descPlaceholder: string; color: string; bg: string; border: string }> = {
  note: { button: '📝 Not Ekle', title: '📝 Not', amountLabel: '', amountPlaceholder: '', descLabel: 'İşe Dair Not *', descPlaceholder: 'Örn: Kepçe tam gün mesai', color: '#1565C0', bg: '#E3F2FD', border: '#1E88E5' },
  fuel: { button: '⛽ Mazot Ver', title: '⛽ Mazot', amountLabel: 'Verilen Mazot Miktarı (Litre) *', amountPlaceholder: 'Örn: 150', descLabel: 'Açıklama / Kime / Hangi Araca Verildi *', descPlaceholder: 'Örn: 34 ABC 123 plakalı ekskavatöre verildi', color: '#E65100', bg: '#FFF3E0', border: '#FB8C00' },
  expense: { button: '💵 Gider Ekle', title: '💵 Gider', amountLabel: 'Gider Tutarı (TL) *', amountPlaceholder: 'Örn: 2500', descLabel: 'Gider Açıklaması / Detay *', descPlaceholder: 'Örn: Şantiye yemek/su masrafı', color: '#2E7D32', bg: '#E8F5E9', border: '#43A047' },
};

const BUTTON_ORDER: NoteKind[] = ['note', 'fuel', 'expense'];
const ACCESSORY_ID = 'jobNotesKeyboardDone';

// Açık kart: yeni kayıt (tipe göre) veya mevcut kaydı düzenleme
type FormMode = { kind: 'create'; type: NoteKind } | { kind: 'edit'; note: JobSiteNoteItem } | null;

// Backend {message} döner; eski uçlar Result<T> {errors: []} dönebilir; 403 gövdesiz gelebilir
const apiErrorMessage = (err: any, fallback: string, forbidden?: string): string => {
  const data = err?.response?.data;
  const msg = (typeof data?.message === 'string' && data.message) || (Array.isArray(data?.errors) && typeof data.errors[0] === 'string' && data.errors[0]) || '';
  if (msg) return msg;
  if (err?.response?.status === 403 && forbidden) return forbidden;
  return fallback;
};

const parseAmount = (s: string): number | undefined => {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? undefined : n;
};

const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export interface JobNotesModalProps {
  visible: boolean;
  onClose: () => void;
  jobSiteId?: string;
  token?: string | null;
  jobName?: string;
  /** API `canManage` alanı yoksa (eski API) kullanılacak yetki — eski davranış: şantiye sahibi */
  fallbackCanManage: boolean;
  /** Mazot kaydı ekleme/güncelleme/silme sonrası API'nin döndüğü yeni tanker stoğu */
  onFuelStockChange?: (fuelStock: number) => void;
}

interface NoteCardProps {
  item: JobSiteNoteItem;
  canManage: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: (item: JobSiteNoteItem) => void;
  onDelete: (item: JobSiteNoteItem) => void;
}

const NoteCard = React.memo(({ item, canManage, isEditing, isDeleting, onEdit, onDelete }: NoteCardProps) => {
  const meta = KIND_META[typeToKind(item.noteType)];
  const badge = item.noteType === 1 ? `⛽ Mazot: ${item.amount ?? 0} Lt` : item.noteType === 2 ? `💵 Gider: ${(item.amount ?? 0).toLocaleString('tr-TR')} ₺` : '📝 Not';
  return (
    <View style={[styles.noteCard, isEditing && styles.noteCardEditing]}>
      <View style={styles.noteCardTop}>
        <View style={[styles.noteBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.noteBadgeText, { color: meta.color }]}>{badge}</Text>
        </View>
        <Text style={styles.noteDateText}>{formatDate(item.createdDate)}</Text>
      </View>
      <Text style={styles.noteDescText}>{item.description}</Text>
      <View style={styles.noteCardBottom}>
        <Text style={styles.noteUserText} numberOfLines={1}>
          👤 {item.userName || 'Bilinmiyor'}
        </Text>
        {canManage &&
          (isEditing ? (
            <Text style={styles.noteEditingText}>✏️ Düzenleniyor</Text>
          ) : (
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={() => onEdit(item)} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.noteActionEdit}>✏️ Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item)} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {isDeleting ? <ActivityIndicator size="small" color="#C62828" /> : <Text style={styles.noteActionDelete}>🗑️ Sil</Text>}
              </TouchableOpacity>
            </View>
          ))}
      </View>
    </View>
  );
});

export default function JobNotesModal({ visible, onClose, jobSiteId, token, jobName, fallbackCanManage, onFuelStockChange }: JobNotesModalProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<JobSiteNoteItem>>(null);
  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuelCbRef = useRef(onFuelStockChange);
  fuelCbRef.current = onFuelStockChange;

  const [notes, setNotes] = useState<JobSiteNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const resetForm = useCallback(() => {
    setMode(null);
    setAmount('');
    setDescription('');
    setFormError(null);
  }, []);

  const showFlash = useCallback((text: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(text);
    flashTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setFlash(null);
    }, 2500);
  }, []);

  const applyFuelStock = (res: any) => {
    const stock = res?.fuelStock ?? res?.FuelStock;
    if (typeof stock === 'number') fuelCbRef.current?.(stock);
  };

  const loadNotes = useCallback(
    async (pull = false) => {
      if (!token || !jobSiteId) return;
      const seq = ++loadSeqRef.current;
      if (pull) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await getJobSiteNotes(token, jobSiteId);
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setNotes(Array.isArray(data) ? data : []);
        setLoadError(false);
      } catch {
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        setLoadError(true);
      } finally {
        if (mountedRef.current && seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, jobSiteId],
  );

  // Her açılışta listeyi tazele; kapanınca açık kartı sıfırla
  useEffect(() => {
    if (visible) {
      loadNotes();
    } else {
      resetForm();
      setFlash(null);
    }
  }, [visible, loadNotes, resetForm]);

  // Şantiye değişirse eski şantiyenin notları görünmesin
  useEffect(() => {
    setNotes([]);
  }, [jobSiteId]);

  const handleClose = useCallback(() => {
    // Klavye açıkken modal kapatmak iOS'ta takılmaya yol açabiliyor: önce klavyeyi kapat
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (mountedRef.current) onClose();
      }, 150);
      return;
    }
    onClose();
  }, [onClose]);

  const toggleCreate = (type: NoteKind) => {
    if (saving) return;
    setFormError(null);
    if (mode?.kind === 'create' && mode.type === type) {
      Keyboard.dismiss();
      resetForm();
      return;
    }
    setAmount('');
    setDescription('');
    setMode({ kind: 'create', type });
  };

  const startEdit = useCallback(
    (item: JobSiteNoteItem) => {
      if (saving) return;
      Keyboard.dismiss();
      setFormError(null);
      setAmount(item.amount !== undefined && item.amount !== null ? String(item.amount) : '');
      setDescription(item.description || '');
      setMode({ kind: 'edit', note: item });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [saving],
  );

  const cancelForm = () => {
    Keyboard.dismiss();
    resetForm();
  };

  const handleSave = async () => {
    if (!mode || saving || !token || !jobSiteId) return;
    const noteType = mode.kind === 'create' ? KIND_TO_TYPE[mode.type] : mode.note.noteType;
    const amt = noteType !== 0 ? parseAmount(amount) : undefined;
    if (noteType !== 0 && (!amt || amt <= 0)) {
      setFormError('Lütfen geçerli bir miktar girin.');
      return;
    }
    if (!description.trim()) {
      setFormError('Lütfen bir açıklama girin.');
      return;
    }
    Keyboard.dismiss();
    setFormError(null);
    setSaving(true);
    try {
      if (mode.kind === 'create') {
        const res = await createJobSiteNote(token, jobSiteId, { noteType, amount: amt, description: description.trim() });
        applyFuelStock(res);
        if (!mountedRef.current) return;
        showFlash('✓ Kayıt eklendi.');
      } else {
        const res = await updateJobSiteNote(token, jobSiteId, mode.note.id, { amount: amt, description: description.trim() });
        applyFuelStock(res);
        if (!mountedRef.current) return;
        showFlash('✓ Kayıt güncellendi.');
      }
      resetForm();
      loadNotes();
    } catch (err: any) {
      if (!mountedRef.current) return;
      setFormError(mode.kind === 'create' ? apiErrorMessage(err, 'Kayıt eklenirken bir hata oluştu.') : apiErrorMessage(err, 'Güncellenirken bir hata oluştu.', 'Bu notu düzenleme yetkiniz yok.'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleDelete = useCallback(
    (item: JobSiteNoteItem) => {
      Keyboard.dismiss();
      Alert.alert('Notu Sil', 'Bu notu/gideri silmek istediğinizden emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!token || !jobSiteId) return;
            setDeletingId(item.id);
            try {
              const res = await deleteJobSiteNote(token, jobSiteId, item.id);
              applyFuelStock(res);
              if (!mountedRef.current) return;
              setNotes(prev => prev.filter(n => n.id !== item.id));
              setMode(m => (m?.kind === 'edit' && m.note.id === item.id ? null : m));
              showFlash('✓ Kayıt silindi.');
              loadNotes();
            } catch (err: any) {
              if (!mountedRef.current) return;
              Alert.alert('Hata', apiErrorMessage(err, 'Silinirken bir hata oluştu.', 'Bu notu silme yetkiniz yok.'));
            } finally {
              if (mountedRef.current) setDeletingId(null);
            }
          },
        },
      ]);
    },
    [token, jobSiteId, loadNotes, showFlash],
  );

  const editingId = mode?.kind === 'edit' ? mode.note.id : null;

  const renderItem = useCallback(({ item }: { item: JobSiteNoteItem }) => <NoteCard item={item} canManage={item.canManage ?? fallbackCanManage} isEditing={editingId === item.id} isDeleting={deletingId === item.id} onEdit={startEdit} onDelete={handleDelete} />, [fallbackCanManage, editingId, deletingId, startEdit, handleDelete]);

  // ── Açılır giriş kartı (yeni kayıt / düzenleme)
  const formKind: NoteKind | null = mode ? (mode.kind === 'create' ? mode.type : typeToKind(mode.note.noteType)) : null;
  const meta = formKind ? KIND_META[formKind] : null;
  const accessoryId = Platform.OS === 'ios' ? ACCESSORY_ID : undefined;

  const formCard =
    mode && meta && formKind ? (
      <View style={[styles.formCard, { borderColor: meta.border }]}>
        <Text style={[styles.formTitle, { color: meta.color }]}>{mode.kind === 'edit' ? `✏️ Kaydı Düzenle · ${meta.title}` : meta.button}</Text>
        {formKind !== 'note' && (
          <View style={styles.formField}>
            <Text style={styles.inputLabel}>{meta.amountLabel}</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} inputAccessoryViewID={accessoryId} placeholder={meta.amountPlaceholder} placeholderTextColor="#9E9E9E" style={styles.amountInput} editable={!saving} />
          </View>
        )}
        <Text style={styles.inputLabel}>{meta.descLabel}</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder={meta.descPlaceholder} placeholderTextColor="#9E9E9E" multiline returnKeyType="done" submitBehavior="blurAndSubmit" inputAccessoryViewID={accessoryId} style={styles.descInput} editable={!saving} />
        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <View style={styles.formButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm} disabled={saving}>
            <Text style={styles.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{mode.kind === 'edit' ? '💾 Güncelle' : '💾 Kaydet'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    ) : null;

  // ListHeaderComponent'e element veriyoruz (bileşen değil) — böylece yazarken input yeniden mount olmaz, odak kaybolmaz
  const listHeader = (
    <View>
      <View style={styles.typeRow}>
        {BUTTON_ORDER.map(k => {
          const active = formKind === k;
          const m = KIND_META[k];
          return (
            <TouchableOpacity key={k} style={[styles.typeBtn, active && { backgroundColor: m.bg, borderColor: m.border }]} onPress={() => toggleCreate(k)} activeOpacity={0.8}>
              <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]} numberOfLines={1}>
                {m.button}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {formCard}
      {!!flash && (
        <View style={styles.flash}>
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      )}
      <View style={styles.listTitleRow}>
        <Text style={styles.listTitle}>Geçmiş Kayıtlar</Text>
        {loading && notes.length > 0 && <ActivityIndicator size="small" color="#1A237E" />}
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.emptyBox}>
      <ActivityIndicator size="small" color="#1A237E" />
    </View>
  ) : (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{loadError ? 'Kayıtlar yüklenemedi. Yenilemek için listeyi aşağı çekin.' : 'Henüz eklenmiş not veya gider bulunmuyor.'}</Text>
    </View>
  );

  // Android'de modal durum çubuğunun altına çizilir (statusBarTranslucent) → üst boşluğu kendimiz veriyoruz
  const topGap = (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 24) : insets.top) + 12;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ height: topGap }} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>📝 İş Notları & Giderler</Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  {jobName || 'Şantiye'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Kapat">
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
          <FlatList
            ref={listRef}
            style={styles.list}
            data={notes}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            extraData={editingId}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshing={refreshing}
            onRefresh={() => loadNotes(true)}
            contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
          />
        </View>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.accessoryDone}>Bitti</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A237E',
  },
  subTitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
  },
  typeBtnTextActive: {
    color: '#111',
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  formField: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#455A64',
    marginBottom: 4,
  },
  amountInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#263238',
  },
  descInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#263238',
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  formError: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#C62828',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#ECEFF1',
  },
  cancelBtnText: {
    color: '#455A64',
    fontWeight: '800',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#1A237E',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
  flash: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  flashText: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 13,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#37474F',
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  noteCardEditing: {
    borderColor: '#1A237E',
    borderWidth: 1.5,
  },
  noteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  noteBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noteDateText: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  noteDescText: {
    fontSize: 13,
    color: '#212121',
    lineHeight: 18,
    marginBottom: 8,
  },
  noteCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 6,
  },
  noteUserText: {
    flexShrink: 1,
    fontSize: 11,
    color: '#757575',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  noteActionEdit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565C0',
  },
  noteActionDelete: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C62828',
  },
  noteEditingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A237E',
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: '#F1F1F1',
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessoryDone: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
});
