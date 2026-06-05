import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView, Image, Linking, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

// URL ve Türkçe telefon numaralarını tespit eder ([\s] yerine [ ] — newline yutmasın)
const LINKIFY_PATTERN = /(https?:\/\/[^\s]+|(?:\+90|0)[5]\d{2}[ \-]?\d{3}[ \-]?\d{2}[ \-]?\d{2})/g;
const IS_LINK_PATTERN = /^(https?:\/\/[^\s]+|(?:\+90|0)[5]\d{2}[ \-]?\d{3}[ \-]?\d{2}[ \-]?\d{2})$/;

const EXACT_BAD_WORDS = [
  'aq', 'amk', 'amq', 'oc', 'oç', 'piç', 'pic', 'göt', 'got', 'sik', 'am'
];

const SUBSTRING_BAD_WORDS = [
  'siktir', 'sikeyim', 'sikerim', 'sikis', 'sikiş', 'orospu', 'pezevenk', 'amcık', 'amcik', 
  'yarrak', 'yarak', 'yavşak', 'yavsak', 'kaltak', 'götveren', 'gotveren', 'pezo', 'gavat', 
  'kavat', 'taşşak', 'tasak', 'taşak', 'godoş', 'godos', 'kancık', 'kancik', 'kahpe', 
  'şerefsiz', 'serefsiz', 'kaşar', 'kasar'
];

function hasProfanity(inputText: string): boolean {
  if (!inputText) return false;
  
  const normalizeText = (str: string) => {
    return str
      .toLowerCase()
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9\s]/g, ' '); // Noktalama işaretlerini boşluk yap
  };

  const normalizedWithSpaces = normalizeText(inputText);
  const words = normalizedWithSpaces.split(/\s+/).filter(Boolean);

  // 1. Kelime bazlı tam eşleşme kontrolü
  for (const word of words) {
    if (EXACT_BAD_WORDS.includes(word) || SUBSTRING_BAD_WORDS.includes(word)) {
      return true;
    }
  }

  // 2. Alt kelime kontrolü (boşluklar atılmış tüm mesaj içinde)
  const normalizedNoSpaces = normalizedWithSpaces.replace(/\s+/g, '');
  for (const badWord of SUBSTRING_BAD_WORDS) {
    if (normalizedNoSpaces.includes(badWord)) {
      return true;
    }
  }

  return false;
}

function LinkifiedText({ text, style }: { text: string; style?: any }) {
  // \r\n ve \r → \n normalize et (Windows/eski sistemlerden gelen mesajlar için)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split(LINKIFY_PATTERN);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (!IS_LINK_PATTERN.test(part)) {
          return <Text key={i}>{part}</Text>;
        }
        const isUrl = part.startsWith('http');
        const href = isUrl ? part : `tel:${part.replace(/[ \-]/g, '')}`;
        return (
          <Text
            key={i}
            style={styles.linkText}
            onPress={() => Linking.openURL(href)}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { HubConnectionBuilder, HubConnection, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { useAppSelector } from '../../hooks';
import { getUserById } from '../../services/userService';
import {
  getGroupMessages, sendMessage as sendMsgComp,
  getGroupDetail, updateGroupSettings, uploadGroupImage,
  deleteGroup as deleteChatGroup, getBlockedPhones,
  addBlockedPhone, removeBlockedPhone,
} from '../../services/chatService';

const HUB_URL = 'https://api.hafriyapp.com/hubs/chat';

const YELLOW = '#FFD500';
const IMAGE_BASE = 'https://api.hafriyapp.com';
const buildImgUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function CompanyChat() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { group, company } = route.params;
  const groupData = group || company;
  const title = groupData?.name;
  const groupId = groupData?.id;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const token = useAppSelector(state => state.auth.token);
  const currentUserId = useAppSelector(state => state.auth.user?.id);

  const connectionRef = useRef<HubConnection | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── SETTINGS ─── */
  const [isOwner, setIsOwner] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsGroup, setSettingsGroup] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsNewImage, setSettingsNewImage] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
  const [blockInputPhone, setBlockInputPhone] = useState('');
  const [blockingPhone, setBlockingPhone] = useState(false);
  const [groupDeleting, setGroupDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ─── REPORT & OPTION MODALS ─── */
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportedUserPhone, setReportedUserPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (!token || !groupId) return;
      try {
        const res = await getGroupMessages(token, groupId);
        if (res?.data?.messages) {
          const incoming: any[] = res.data.messages.reverse();
          setMessages(prev => {
            const existingIds = new Set(prev.filter(m => !m.isTemp).map(m => m.id));
            const newOnes = incoming.filter(m => !existingIds.has(m.id));
            if (!newOnes.length) return prev;
            const withoutTemp = prev.filter(m => !m.isTemp);
            return [...newOnes.reverse(), ...withoutTemp];
          });
        }
      } catch {}
    }, 3000);
  }, [token, groupId]);

  const disconnectSignalR = useCallback(async () => {
    stopPolling();
    if (connectionRef.current) {
      try { await connectionRef.current.stop(); } catch {}
      connectionRef.current = null;
    }
  }, [stopPolling]);

  const connectSignalR = useCallback(async () => {
    if (!groupId) return;
    await disconnectSignalR();
    seenIdsRef.current = new Set();

    try {
      const connection = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      connection.on('ReceiveGroupMessage', (message: any) => {
        const id = String(message.id);
        if (seenIdsRef.current.has(id)) return;
        seenIdsRef.current.add(id);

        const isOwn = message.senderId === currentUserId;
        const incoming = { ...message, isOwnMessage: isOwn };

        setMessages(prev => {
          if (isOwn) {
            const tempIdx = prev.findIndex(m => m.isTemp && m.content === message.content);
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = incoming;
              return updated;
            }
          }
          return [incoming, ...prev];
        });
      });

      connection.on('MessageDeleted', (messageId: string) => {
        setMessages(prev =>
          prev.map(m => m.id === messageId ? { ...m, content: 'Bu mesaj silindi', deleted: true } : m)
        );
      });

      await connection.start();
      await connection.invoke('JoinChatGroup', groupId);
      connectionRef.current = connection;
    } catch (err) {
      console.log('[SignalR] bağlantı kurulamadı, polling başlıyor', err);
      startPolling();
    }
  }, [groupId, currentUserId, disconnectSignalR, startPolling]);

  // groupId değişince mesajları temizle ve yeniden yükle (farklı gruba geçişte eski mesajlar görünmesin)
  useEffect(() => {
    setMessages([]);
    setIsOwner(false);
    seenIdsRef.current = new Set();
    fetchMessages();
    checkOwnership();
    connectSignalR();
    return () => { disconnectSignalR(); };
  }, [groupId]);

  const checkOwnership = async () => {
    if (!token || !groupId) return;
    try {
      const res = await getGroupDetail(token, groupId);
      setIsOwner(!!res?.data?.isOwner);
    } catch { /* sessizce geç */ }
  };

  const openSettings = async () => {
    setSettingsVisible(true);
    setSettingsLoading(true);
    setSettingsGroup(null);
    setSettingsNewImage(null);
    setBlockedPhones([]);
    setBlockInputPhone('');
    try {
      const res = await getGroupDetail(token!, groupId);
      const detail = res?.data;
      if (!detail) throw new Error();
      setSettingsGroup(detail);
      setSettingsName(detail.name || '');
      setSettingsDesc(detail.description || '');
      const bpRes = await getBlockedPhones(token!, groupId);
      setBlockedPhones(bpRes?.data || []);
    } catch {
      setSettingsVisible(false);
      Alert.alert('Hata', 'Grup bilgileri yüklenemedi.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const pickSettingsImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 800, maxHeight: 800 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.base64) return;
        setSettingsNewImage(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
      },
    );
  };

  const saveSettings = async () => {
    if (!settingsGroup || !token) return;
    setSettingsSaving(true);
    try {
      if (settingsNewImage) {
        await uploadGroupImage(token, settingsGroup.id, settingsNewImage);
      }
      await updateGroupSettings(token, settingsGroup.id, {
        name: settingsName,
        description: settingsDesc,
      });
      Alert.alert('Başarılı', 'Grup bilgileri güncellendi.');
    } catch {
      Alert.alert('Hata', 'Grup güncellenemedi.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAddBlockedPhone = async () => {
    const phone = blockInputPhone.trim();
    if (!phone || !settingsGroup || !token) return;
    setBlockingPhone(true);
    try {
      await addBlockedPhone(token, settingsGroup.id, phone);
      setBlockInputPhone('');
      const bpRes = await getBlockedPhones(token, settingsGroup.id);
      setBlockedPhones(bpRes?.data || []);
    } catch {
      Alert.alert('Hata', 'Numara engellenemedi.');
    } finally {
      setBlockingPhone(false);
    }
  };

  const handleRemoveBlockedPhone = async (phone: string) => {
    if (!settingsGroup || !token) return;
    try {
      await removeBlockedPhone(token, settingsGroup.id, phone);
      setBlockedPhones(prev => prev.filter(p => p !== phone));
    } catch {
      Alert.alert('Hata', 'Numara kaldırılamadı.');
    }
  };

  const handleDeleteGroup = () => {
    if (!settingsGroup || !token) return;
    Alert.alert(
      'Grubu Sil',
      'Grubu silmek geri alınamaz. Tüm mesajlar ve üyeler silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setGroupDeleting(true);
            try {
              await deleteChatGroup(token!, settingsGroup.id);
              setSettingsVisible(false);
              navigation.goBack();
            } catch {
              Alert.alert('Hata', 'Grup silinemedi.');
            } finally {
              setGroupDeleting(false);
            }
          },
        },
      ],
    );
  };

  const fetchMessages = async () => {
    if (!token || !groupId) return;
    setLoading(true);
    try {
      const res = await getGroupMessages(token, groupId);
      if (res?.data?.messages) {
        const msgs: any[] = res.data.messages.reverse();
        msgs.forEach(m => seenIdsRef.current.add(String(m.id)));
        setMessages(msgs);
      }
    } catch (error) {
      console.log('Error fetching messages', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!text.trim()) return;

    const content = text.trim();

    if (hasProfanity(content)) {
      Alert.alert('Uyarı', 'Mesajınız küfür ve hakaret içerdiği için gönderilemiyor.');
      return;
    }

    setText('');

    // Optimistik update: Hemen listeye ekle (Listenin sonuna ekliyoruz çünkü inverted değil ama sıralama eski->yeni)
    // Bekle, eğer listeyi reverse() ettiysek (Eski -> Yeni), o zaman sona eklemeliyiz.
    // FlatList inverted OLMADIĞI için, en aşağıya scroll etmesi lazım veya biz sona ekleriz.
    // Kullanıcı deneyimi: Mesajlar yukarıdan aşağı akar. En son mesaj en alttadır.
    // Bu durumda array: [Eski, ..., Yeni] olmalı.
    // sendMessage ile sona ekleriz: [...prev, newMessage]

    const tempId = `temp_${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content,
      isOwnMessage: true,
      isTemp: true,
      sentAt: new Date().toISOString(),
    };

    setMessages(prev => [tempMessage, ...prev]);
    setSending(true);

    try {
      if (!token) throw new Error('Oturum açık değil');
      await sendMsgComp(token, groupId, content);
      // SignalR teslim edecek, temp mesaj orada replace edilecek.
      // Polling modundaysa temp'i koru — polling sonucu güncelleyecek.
    } catch (error) {
      Alert.alert('Hata', 'Mesaj gönderilemedi, tekrar deneyiniz.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = (item: any) => {
    if (item.deleted || item.isTemp || !item.content) return;
    // Panoya kopyalarken orijinal içeriği koru (satır sonları dahil)
    const content: string = item.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    Clipboard.setString(content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenMessageOptions = (messageItem: any) => {
    if (messageItem.deleted || messageItem.isTemp || !messageItem.content) return;
    setSelectedMessage(messageItem);
    setMessageOptionsVisible(true);
  };

  const handleCopyFromOptions = () => {
    if (!selectedMessage) return;
    handleCopyMessage(selectedMessage);
    setMessageOptionsVisible(false);
  };

  const handleOpenReportModal = async () => {
    if (!selectedMessage) return;
    setMessageOptionsVisible(false);
    setReportReason('');
    setReportedUserPhone('');
    
    const directPhone = selectedMessage.senderPhone || selectedMessage.senderPhoneNumber || selectedMessage.phone;
    if (directPhone) {
      setReportedUserPhone(directPhone);
      setReportModalVisible(true);
      return;
    }

    if (selectedMessage.senderId && token) {
      setLoadingPhone(true);
      setReportModalVisible(true);
      try {
        const userData = await getUserById(selectedMessage.senderId, token);
        if (userData && userData.phoneNumber) {
          setReportedUserPhone(userData.phoneNumber);
        } else if (userData && userData.data && userData.data.phoneNumber) {
          setReportedUserPhone(userData.data.phoneNumber);
        } else {
          setReportedUserPhone('Belirtilmemiş');
        }
      } catch (err) {
        console.log('[CompanyChat] User phone fetch error:', err);
        setReportedUserPhone('Belirtilmemiş');
      } finally {
        setLoadingPhone(false);
      }
    } else {
      setReportedUserPhone('Belirtilmemiş');
      setReportModalVisible(true);
    }
  };

  const handleSendReport = async () => {
    if (!selectedMessage) return;
    const reason = reportReason.trim();
    if (!reason) {
      Alert.alert('Uyarı', 'Lütfen şikayet nedeninizi belirtin.');
      return;
    }

    const adminPhone = '+905383573913';
    const groupName = groupData?.name || 'Grup Bilgisi Yok';
    const msgContent = selectedMessage.content || '';
    const senderName = selectedMessage.senderName || 'Belirtilmemiş';
    const senderPhoneStr = reportedUserPhone || 'Bilinmiyor';

    const messageTemplate = `Merhaba, Hafriyapp uygulamasında bir mesajı şikayet etmek istiyorum:\n\n` +
      `Grup/Firma: ${groupName}\n` +
      `Mesaj ID: ${selectedMessage.id}\n` +
      `Gönderen Adı: ${senderName}\n` +
      `Gönderen Telefon: ${senderPhoneStr}\n` +
      `Mesaj İçeriği: ${msgContent}\n\n` +
      `Şikayet Nedeni:\n${reason}`;

    const appUrl = `whatsapp://send?phone=${adminPhone}&text=${encodeURIComponent(messageTemplate)}`;
    const webUrl = `https://wa.me/${adminPhone.replace(/[+\s]/g, '')}?text=${encodeURIComponent(messageTemplate)}`;

    setReportModalVisible(false);
    setSelectedMessage(null);
    setReportReason('');

    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const renderItem = ({ item }: any) => {
    const isMyMessage = item.isOwnMessage;
    const isDeleted = !!item.deleted;
    const isTemp = !!item.isTemp;
    const isCopied = copiedId === item.id;
    return (
      <View style={[styles.bubbleContainer, isMyMessage ? styles.myContainer : styles.theirContainer]}>
        {!isMyMessage && item.senderName && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <TouchableOpacity
          onLongPress={() => handleOpenMessageOptions(item)}
          activeOpacity={0.8}
          delayLongPress={300}
        >
          <View style={[
            styles.bubble,
            isMyMessage ? styles.myBubble : styles.theirBubble,
            isDeleted && styles.deletedBubble,
            isTemp && styles.tempBubble,
          ]}>
            {isDeleted
              ? <Text style={[styles.bubbleText, styles.deletedText]}>Bu mesaj silindi</Text>
              : <LinkifiedText text={item.content} style={styles.bubbleText} />
            }
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, gap: 4 }}>
              {isTemp && <Text style={styles.sendingDot}>⏳</Text>}
              {isCopied && <Text style={styles.copiedText}>Kopyalandı ✓</Text>}
              <Text style={styles.timeText}>
                {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 🔙 HEADER */}
      <View style={[styles.header, { paddingTop: insets.top, height: 52 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => setDetailVisible(true)} style={styles.detailBtn}>
            <Text style={styles.detailBtnText}>Detay</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={openSettings} style={styles.settingsBtn}>
              <Text style={styles.settingsBtnText}>⚙</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 10 }}
          inverted
          keyboardShouldPersistTaps="handled"
        />

        <View style={[styles.inputRow, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Mesaj yaz..."
            style={styles.input}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ fontWeight: '700' }}>Gönder</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* GRUP DETAY MODAL */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.detailModal}>
          {/* Banner */}
          <View style={styles.detailBanner}>
            <TouchableOpacity style={styles.detailClose} onPress={() => setDetailVisible(false)}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }}>✕</Text>
            </TouchableOpacity>
            <View style={styles.detailAvatar}>
              {buildImgUrl(groupData?.imageUrl) ? (
                <Image source={{ uri: buildImgUrl(groupData.imageUrl) }} style={{ width: '100%', height: '100%', borderRadius: 35 }} />
              ) : (
                <Text style={{ fontSize: 30 }}>🏢</Text>
              )}
            </View>
            <Text style={styles.detailGroupName}>{title}</Text>
            <Text style={styles.detailMemberCount}>
              {groupData?.memberCount ? `${groupData.memberCount} üye` : ''}
            </Text>
          </View>

          {/* Detaylar */}
          <ScrollView style={styles.detailBody}>
            {!!groupData?.description && (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}><Text>ℹ︎</Text></View>
                <View style={styles.infoText}>
                  <Text style={styles.detailLabel}>AÇIKLAMA</Text>
                  <Text style={styles.detailValue}>{groupData.description}</Text>
                </View>
              </View>
            )}

            {!!groupData?.provinceName && (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}><Text>📍</Text></View>
                <View style={styles.infoText}>
                  <Text style={styles.detailLabel}>BÖLGE</Text>
                  <Text style={styles.detailValue}>{groupData.provinceName}</Text>
                </View>
              </View>
            )}

            {!!groupData?.ownerName && (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}><Text>👤</Text></View>
                <View style={styles.infoText}>
                  <Text style={styles.detailLabel}>GRUP SAHİBİ</Text>
                  <Text style={styles.detailValue}>{groupData.ownerName}</Text>
                </View>
              </View>
            )}

            {!!groupData?.createdDate && (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}><Text>📅</Text></View>
                <View style={styles.infoText}>
                  <Text style={styles.detailLabel}>OLUŞTURULMA TARİHİ</Text>
                  <Text style={styles.detailValue}>
                    {new Date(groupData.createdDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            )}

            {groupData?.isPublic !== undefined && (
              <View style={styles.detailItem}>
                <View style={styles.iconBox}><Text>{groupData.isPublic ? '🔓' : '🔒'}</Text></View>
                <View style={styles.infoText}>
                  <Text style={styles.detailLabel}>GRUP TÜRÜ</Text>
                  <Text style={styles.detailValue}>{groupData.isPublic ? 'Herkese Açık' : 'Onaylı Katılım'}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* GRUP AYARLARI MODAL */}
      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={ss.container}>
          <View style={ss.header}>
            <TouchableOpacity onPress={() => setSettingsVisible(false)} style={ss.backBtn}>
              <Text style={ss.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={ss.headerTitle}>⚙ Grup Ayarları</Text>
            <View style={{ width: 44 }} />
          </View>

          {settingsLoading ? (
            <View style={ss.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD500" />
              <Text style={ss.loadingText}>Yükleniyor...</Text>
            </View>
          ) : settingsGroup ? (
            <ScrollView style={ss.body} keyboardShouldPersistTaps="handled">
              {/* Logo */}
              <Text style={ss.label}>Grup Logosu</Text>
              <View style={ss.logoSection}>
                <View style={ss.logoCircle}>
                  {settingsNewImage ? (
                    <Image source={{ uri: settingsNewImage }} style={ss.logoImg} />
                  ) : buildImgUrl(settingsGroup.imageUrl) ? (
                    <Image source={{ uri: buildImgUrl(settingsGroup.imageUrl) }} style={ss.logoImg} />
                  ) : (
                    <Text style={{ fontSize: 36 }}>🏢</Text>
                  )}
                </View>
                <TouchableOpacity style={ss.pickImageBtn} onPress={pickSettingsImage}>
                  <Text style={ss.pickImageText}>⊙ Resim Seç</Text>
                </TouchableOpacity>
              </View>

              {/* Grup Adı */}
              <Text style={ss.label}>Grup Adı</Text>
              <TextInput
                style={ss.input}
                value={settingsName}
                onChangeText={setSettingsName}
                placeholder="Grup adı..."
              />

              {/* Açıklama */}
              <Text style={ss.label}>Açıklama</Text>
              <TextInput
                style={[ss.input, ss.textArea]}
                value={settingsDesc}
                onChangeText={setSettingsDesc}
                placeholder="Grup açıklaması..."
                multiline
                textAlignVertical="top"
              />

              {/* Kaydet */}
              <TouchableOpacity style={ss.saveBtn} onPress={saveSettings} disabled={settingsSaving}>
                {settingsSaving
                  ? <ActivityIndicator color="#333" />
                  : <Text style={ss.saveBtnText}>✓ Kaydet</Text>}
              </TouchableOpacity>

              {/* Engellenen Numaralar */}
              <View style={ss.blockedCard}>
                <Text style={ss.blockedTitle}>🛡 Engellenen Numaralar</Text>
                <Text style={ss.blockedSubtitle}>Engellenen numaralar bu gruba mesaj gönderemez.</Text>
                <View style={ss.blockRow}>
                  <TextInput
                    style={ss.blockInput}
                    value={blockInputPhone}
                    onChangeText={setBlockInputPhone}
                    placeholder="05XX XXX XX XX"
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity style={ss.blockBtn} onPress={handleAddBlockedPhone} disabled={blockingPhone}>
                    {blockingPhone
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={ss.blockBtnText}>+ Engelle</Text>}
                  </TouchableOpacity>
                </View>
                {blockedPhones.length === 0 ? (
                  <Text style={ss.noBlockedText}>✓ Engellenen numara yok</Text>
                ) : (
                  blockedPhones.map(phone => (
                    <View key={phone} style={ss.blockedPhoneRow}>
                      <Text style={ss.blockedPhoneText}>{phone}</Text>
                      <TouchableOpacity onPress={() => handleRemoveBlockedPhone(phone)} style={ss.removeBlockBtn}>
                        <Text style={ss.removeBlockBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {/* Danger Zone */}
              <View style={ss.dangerCard}>
                <Text style={ss.dangerText}>
                  Grubu silmek geri alınamaz. Tüm mesajlar ve üyeler silinecektir.
                </Text>
                <TouchableOpacity style={ss.deleteBtn} onPress={handleDeleteGroup} disabled={groupDeleting}>
                  {groupDeleting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={ss.deleteBtnText}>🗑 Grubu Sil</Text>}
                </TouchableOpacity>
              </View>

              {/* Sohbete Dön */}
              <TouchableOpacity style={ss.backToChat} onPress={() => setSettingsVisible(false)}>
                <Text style={ss.backToChatText}>← Sohbete Dön</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* MESAJ SEÇENEKLERİ MODAL */}
      <Modal
        visible={messageOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMessageOptionsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFillObject} 
            onPress={() => setMessageOptionsVisible(false)} 
          />
          <View style={styles.optionsContent}>
            <Text style={styles.optionsTitle}>Mesaj İşlemleri</Text>
            
            <TouchableOpacity style={styles.optionBtn} onPress={handleCopyFromOptions}>
              <Text style={styles.optionText}>📋 Kopyala</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={handleOpenReportModal}>
              <Text style={[styles.optionText, { color: '#C62828' }]}>⚠️ Şikayet Et</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCancelBtn} onPress={() => setMessageOptionsVisible(false)}>
              <Text style={styles.optionCancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ŞİKAYET MODALI */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!loadingPhone) setReportModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <Pressable 
              style={StyleSheet.absoluteFillObject} 
              onPress={() => {
                if (!loadingPhone) setReportModalVisible(false);
              }} 
            />
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Mesajı Şikayet Et</Text>
              
              {selectedMessage && (
                <View style={styles.reportMessagePreview}>
                  <Text style={styles.reportPreviewLabel}>Şikayet Edilen Mesaj:</Text>
                  <Text style={styles.reportPreviewText} numberOfLines={3}>
                    "{selectedMessage.content}"
                  </Text>
                  <Text style={styles.reportSenderText}>
                    Gönderen: {selectedMessage.senderName || 'Belirtilmemiş'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.reportPhoneLabel}>Telefon: </Text>
                    {loadingPhone ? (
                      <ActivityIndicator size="small" color="#FFD500" />
                    ) : (
                      <Text style={styles.reportPhoneValue}>{reportedUserPhone}</Text>
                    )}
                  </View>
                </View>
              )}

              <Text style={styles.reportInputLabel}>Şikayet Nedeni</Text>
              <TextInput
                style={styles.reportTextInput}
                placeholder="Bu mesajı neden şikayet etmek istiyorsunuz? Lütfen belirtiniz..."
                placeholderTextColor="#999"
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.reportButtonRow}>
                <TouchableOpacity 
                  style={[styles.reportBtn, styles.reportCancelBtn]} 
                  onPress={() => setReportModalVisible(false)}
                  disabled={loadingPhone}
                >
                  <Text style={styles.reportCancelBtnText}>Vazgeç</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.reportBtn, styles.reportSubmitBtn]} 
                  onPress={handleSendReport}
                  disabled={loadingPhone}
                >
                  <Text style={styles.reportSubmitBtnText}>WhatsApp ile Bildir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F4' },
  header: {
    height: 52,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  bubbleContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    marginHorizontal: 12,
  },
  myContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    marginBottom: 2,
  },
  bubble: {
    padding: 10,
    borderRadius: 12,
  },
  myBubble: {
    backgroundColor: YELLOW,
  },
  theirBubble: {
    backgroundColor: '#fff',
  },
  bubbleText: {
    fontSize: 15,
    color: '#000',
  },
  timeText: {
    fontSize: 10,
    color: '#555',
  },
  deletedBubble: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deletedText: {
    color: '#aaa',
    fontStyle: 'italic',
  },
  tempBubble: {
    opacity: 0.7,
  },
  sendingDot: {
    fontSize: 9,
  },
  copiedText: {
    fontSize: 10,
    color: '#27AE60',
    fontWeight: '600',
  },
  linkText: {
    color: '#1A6FC4',
    textDecorationLine: 'underline',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: YELLOW,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    height: 40,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailBtn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  detailBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  settingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  settingsBtnText: {
    fontSize: 18,
    color: '#333',
  },
  /* DETAY MODAL */
  detailModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailBanner: {
    backgroundColor: YELLOW,
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  detailClose: {
    position: 'absolute',
    top: 14,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  detailAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailGroupName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  detailMemberCount: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  detailBody: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconBox: {
    width: 36,
    height: 36,
    minWidth: 36,
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  optionCancelBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  optionCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  reportContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  reportMessagePreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  reportPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reportPreviewText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  reportSenderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  reportPhoneLabel: {
    fontSize: 13,
    color: '#666',
  },
  reportPhoneValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  reportInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reportTextInput: {
    backgroundColor: '#fdfdfd',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    height: 100,
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  reportButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reportBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCancelBtn: {
    backgroundColor: '#eee',
  },
  reportCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  reportSubmitBtn: {
    backgroundColor: '#FFD500',
  },
  reportSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});

/* ─── GROUP SETTINGS MODAL STYLES ─── */
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBE6' },
  header: {
    backgroundColor: '#FFD500',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  backBtnText: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  body: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 18 },
  logoSection: { alignItems: 'center', marginBottom: 4, marginTop: 4 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    overflow: 'hidden', borderWidth: 2, borderColor: '#ddd',
  },
  logoImg: { width: 90, height: 90, borderRadius: 45 },
  pickImageBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFD500' },
  pickImageText: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#333',
  },
  textArea: { height: 90, paddingTop: 12 },
  saveBtn: { backgroundColor: '#FFD500', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 22 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#333' },
  blockedCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 24, borderWidth: 1, borderColor: '#eee',
  },
  blockedTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  blockedSubtitle: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18 },
  blockRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  blockInput: {
    flex: 1, backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 14,
  },
  blockBtn: {
    backgroundColor: '#C62828', paddingHorizontal: 16, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', height: 46, minWidth: 90,
  },
  blockBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  noBlockedText: { textAlign: 'center', color: '#aaa', fontSize: 13, paddingVertical: 10 },
  blockedPhoneRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  blockedPhoneText: { fontSize: 14, color: '#333' },
  removeBlockBtn: { padding: 6 },
  removeBlockBtnText: { color: '#C62828', fontWeight: '700', fontSize: 16 },
  dangerCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 20, borderWidth: 1.5, borderColor: '#C62828',
  },
  dangerText: { fontSize: 13, color: '#555', lineHeight: 20, marginBottom: 14 },
  deleteBtn: { backgroundColor: '#C62828', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backToChat: { backgroundColor: '#F0F0F0', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  backToChatText: { color: '#555', fontWeight: '600', fontSize: 15 },
});
