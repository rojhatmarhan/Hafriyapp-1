import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import JobNotesModal from '../src/components/JobNotesModal';
import { getJobSiteNotes, JobSiteNoteItem } from '../src/services/jobSiteNewService';

jest.mock('../src/services/jobSiteNewService', () => ({
  getJobSiteNotes: jest.fn(),
  createJobSiteNote: jest.fn(),
  updateJobSiteNote: jest.fn(),
  deleteJobSiteNote: jest.fn(),
}));

type Instance = ReactTestRenderer.ReactTestInstance;

/** Bir düğümün altındaki tüm metni birleştirir. */
const textOf = (node: Instance | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

const allTexts = (root: Instance) => root.findAllByType(Text).map(t => textOf(t));

const hasText = (root: Instance, needle: string) => allTexts(root).some(t => t.includes(needle));

/** Metni içeren en içteki Text'ten yukarı çıkıp ilk onPress sahibini bulur ve basar. */
const pressByText = async (root: Instance, needle: string) => {
  const target = root.findAllByType(Text).find(t => textOf(t).includes(needle));
  if (!target) throw new Error(`"${needle}" metni bulunamadı`);
  let node: Instance | null = target;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${needle}" için basılabilir öğe yok`);
  const pressable = node;
  await ReactTestRenderer.act(async () => {
    pressable.props.onPress();
  });
};

const note = (overrides: Partial<JobSiteNoteItem>): JobSiteNoteItem => ({
  id: 'n1',
  jobSiteId: 'js-1',
  userId: 'u1',
  userName: 'Ahmet',
  noteType: 0,
  description: 'Kepçe geldi',
  createdDate: '2026-10-20T10:00:00Z',
  canManage: true,
  ...overrides,
});

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

const renderModal = async (props: Partial<React.ComponentProps<typeof JobNotesModal>> = {}) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<JobNotesModal visible onClose={jest.fn()} jobSiteId="js-1" token="tkn" jobName="Kartal Şantiye" fallbackCanManage={false} {...props} />);
  });
  mounted.push(renderer!);
  return renderer!;
};

// FlatList hücre güncellemesi zamanlayıcıyla gelir; test bitmeden unmount ederek "log after tests are done" uyarısını önle
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(r => r.unmount());
  });
});

describe('JobNotesModal', () => {
  beforeEach(() => {
    (getJobSiteNotes as jest.Mock).mockReset();
    (getJobSiteNotes as jest.Mock).mockResolvedValue([]);
  });

  it('shows the three type buttons and no input card by default', async () => {
    const r = await renderModal();
    expect(hasText(r.root, '📝 Not Ekle')).toBe(true);
    expect(hasText(r.root, '⛽ Mazot Ver')).toBe(true);
    expect(hasText(r.root, '💵 Gider Ekle')).toBe(true);
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
    expect(hasText(r.root, 'Kaydet')).toBe(false);
    expect(hasText(r.root, 'Kartal Şantiye')).toBe(true);
    expect(getJobSiteNotes).toHaveBeenCalledWith('tkn', 'js-1');
    expect(hasText(r.root, 'Henüz eklenmiş not veya gider bulunmuyor.')).toBe(true);
  });

  it('pressing "Not Ekle" opens the note card; pressing again closes it', async () => {
    const r = await renderModal();
    await pressByText(r.root, 'Not Ekle');

    const inputs = r.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(1); // genel notta miktar alanı yok
    expect(inputs[0].props.placeholder).toBe('Örn: Kepçe tam gün mesai');
    expect(hasText(r.root, 'İşe Dair Not *')).toBe(true);
    expect(hasText(r.root, '💾 Kaydet')).toBe(true);

    await pressByText(r.root, 'Not Ekle');
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('"Mazot Ver" opens a card with an amount field', async () => {
    const r = await renderModal();
    await pressByText(r.root, 'Mazot Ver');
    const placeholders = r.root.findAllByType(TextInput).map(i => i.props.placeholder);
    expect(placeholders).toEqual(['Örn: 150', 'Örn: 34 ABC 123 plakalı ekskavatöre verildi']);
  });

  it('does not load notes when not visible', async () => {
    const r = await renderModal({ visible: false });
    expect(getJobSiteNotes).not.toHaveBeenCalled();
    expect(hasText(r.root, 'Not Ekle')).toBe(false);
  });

  it('renders notes returned by the API', async () => {
    (getJobSiteNotes as jest.Mock).mockResolvedValue([note({ id: 'n1', description: 'Kepçe tam gün çalıştı', userName: 'Ahmet' }), note({ id: 'n2', noteType: 1, amount: 150, description: 'Ekskavatöre verildi', userName: 'Mehmet' }), note({ id: 'n3', noteType: 2, amount: 2500, description: 'Yemek masrafı' })]);
    const r = await renderModal();
    expect(hasText(r.root, 'Kepçe tam gün çalıştı')).toBe(true);
    expect(hasText(r.root, 'Ekskavatöre verildi')).toBe(true);
    expect(hasText(r.root, 'Yemek masrafı')).toBe(true);
    expect(hasText(r.root, '⛽ Mazot: 150 Lt')).toBe(true);
    expect(hasText(r.root, '💵 Gider: 2.500 ₺')).toBe(true);
    expect(hasText(r.root, '👤 Mehmet')).toBe(true);
    expect(hasText(r.root, 'Henüz eklenmiş not')).toBe(false);
  });

  it('shows Düzenle/Sil only for notes with canManage true', async () => {
    (getJobSiteNotes as jest.Mock).mockResolvedValue([note({ id: 'n1', description: 'Benim notum', canManage: true }), note({ id: 'n2', description: 'Başkasının notu', canManage: false })]);
    const r = await renderModal({ fallbackCanManage: true });
    const texts = allTexts(r.root);
    expect(texts.filter(t => t.includes('Düzenle'))).toHaveLength(1);
    expect(texts.filter(t => t.includes('Sil'))).toHaveLength(1);
  });

  it('hides Düzenle/Sil when canManage is false for every note', async () => {
    (getJobSiteNotes as jest.Mock).mockResolvedValue([note({ id: 'n1', canManage: false })]);
    const r = await renderModal({ fallbackCanManage: true });
    expect(hasText(r.root, 'Düzenle')).toBe(false);
    expect(hasText(r.root, '🗑️ Sil')).toBe(false);
  });

  it('uses fallbackCanManage when the API omits canManage (old API)', async () => {
    const legacy = { ...note({ id: 'n1' }) } as any;
    delete legacy.canManage;

    (getJobSiteNotes as jest.Mock).mockResolvedValue([legacy]);
    const owner = await renderModal({ fallbackCanManage: true });
    expect(hasText(owner.root, '✏️ Düzenle')).toBe(true);
    expect(hasText(owner.root, '🗑️ Sil')).toBe(true);

    (getJobSiteNotes as jest.Mock).mockResolvedValue([legacy]);
    const other = await renderModal({ fallbackCanManage: false });
    expect(hasText(other.root, 'Düzenle')).toBe(false);
    expect(hasText(other.root, '🗑️ Sil')).toBe(false);
  });

  it('pressing Düzenle opens the edit card prefilled with the note', async () => {
    (getJobSiteNotes as jest.Mock).mockResolvedValue([note({ id: 'n1', noteType: 1, amount: 150, description: 'Ekskavatöre verildi' })]);
    const r = await renderModal();
    await pressByText(r.root, 'Düzenle');
    expect(hasText(r.root, '✏️ Kaydı Düzenle · ⛽ Mazot')).toBe(true);
    expect(hasText(r.root, '✏️ Düzenleniyor')).toBe(true);
    expect(hasText(r.root, '💾 Güncelle')).toBe(true);
    const values = r.root.findAllByType(TextInput).map(i => i.props.value);
    expect(values).toEqual(['150', 'Ekskavatöre verildi']);
  });

  it('shows a load error message when the API fails', async () => {
    (getJobSiteNotes as jest.Mock).mockRejectedValue(new Error('500'));
    const r = await renderModal();
    expect(hasText(r.root, 'Kayıtlar yüklenemedi.')).toBe(true);
  });
});
