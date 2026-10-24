import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import ProvinceMultiSelect from '../src/components/ProvinceMultiSelect';
import { CITIES } from '../src/constants/cities';

type Instance = ReactTestRenderer.ReactTestInstance;

const textOf = (node: Instance | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

/** Metni birebir eşleşen Text'ten yukarı çıkıp ilk onPress sahibini basar. */
// Aynı metin hem çipte hem listede olabilir; liste satırı her zaman sonda olduğu için son eşleşme kullanılır.
const pressByExactText = async (root: Instance, text: string) => {
  const target = root.findAllByType(Text).filter(t => textOf(t) === text).pop();
  if (!target) throw new Error(`"${text}" bulunamadı`);
  let node: Instance | null = target;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${text}" için basılabilir öğe yok`);
  const pressable = node;
  await ReactTestRenderer.act(async () => {
    pressable.props.onPress();
  });
};

const pressByLabel = async (root: Instance, label: string) => {
  const node = root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`"${label}" bulunamadı`);
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
};

const texts = (root: Instance) => root.findAllByType(Text).map(textOf);

const render = async (selected: number[], onChange = jest.fn()) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<ProvinceMultiSelect selected={selected} onChange={onChange} />);
  });
  return { r: renderer!, onChange };
};

/** Seçim alanına basarak listeyi açar */
const openList = async (root: Instance) => {
  const field = root.findAll(n => typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => {
    field.props.onPress();
  });
};

const search = async (root: Instance, q: string) => {
  const input = root.findByType(TextInput);
  await ReactTestRenderer.act(async () => {
    input.props.onChangeText(q);
  });
};

describe('ProvinceMultiSelect', () => {
  it('seçim yokken yer tutucu gösterir, liste kapalıdır', async () => {
    const { r } = await render([]);
    expect(texts(r.root)).toContain('İl seçin…');
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('liste açılınca 82 ilin tamamı görünür', async () => {
    const { r } = await render([]);
    await openList(r.root);
    const all = texts(r.root);
    expect(CITIES).toHaveLength(82);
    for (const city of CITIES) expect(all).toContain(city.label);
  });

  it('işaretlenen iller Tamam ile seçim sırasıyla aktarılır', async () => {
    const { r, onChange } = await render([]);
    await openList(r.root);
    await pressByExactText(r.root, 'Ankara');
    await pressByExactText(r.root, 'İstanbul (Avrupa)');
    expect(onChange).not.toHaveBeenCalled(); // Tamam'a basılmadan aktarılmaz
    await pressByExactText(r.root, 'Tamam (2)');
    expect(onChange).toHaveBeenCalledWith([6, 340]);
  });

  it('Vazgeç seçimi aktarmaz', async () => {
    const { r, onChange } = await render([6]);
    await openList(r.root);
    await pressByExactText(r.root, 'İzmir');
    await pressByExactText(r.root, 'Vazgeç');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seçili il işaretli gelir, işareti kaldırılınca çıkarılır', async () => {
    const { r, onChange } = await render([6, 35]);
    await openList(r.root);
    await pressByExactText(r.root, 'Ankara');
    await pressByExactText(r.root, 'Tamam (1)');
    expect(onChange).toHaveBeenCalledWith([35]);
  });

  it('Türkçe arama: "izmir" ve "istanbul" bulunur', async () => {
    const { r } = await render([]);
    await openList(r.root);
    await search(r.root, 'izmir');
    expect(texts(r.root)).toContain('İzmir');
    await search(r.root, 'istanbul');
    const t = texts(r.root);
    expect(t).toContain('İstanbul (Avrupa)');
    expect(t).toContain('İstanbul (Asya)');
    expect(t).not.toContain('Ankara');
  });

  it('Bulunanları seç: aramadaki tüm illeri işaretler', async () => {
    const { r, onChange } = await render([]);
    await openList(r.root);
    await search(r.root, 'istanbul');
    await pressByExactText(r.root, 'Bulunanları seç');
    await pressByExactText(r.root, 'Tamam (2)');
    expect(onChange).toHaveBeenCalledWith([340, 341]);
  });

  it('Temizle tüm işaretleri kaldırır', async () => {
    const { r, onChange } = await render([6, 35]);
    await openList(r.root);
    await pressByExactText(r.root, 'Temizle');
    await pressByExactText(r.root, 'Tamam (0)');
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('kapalıyken çipteki ✕ ili hemen çıkarır', async () => {
    const { r, onChange } = await render([6, 35]);
    await pressByLabel(r.root, 'Ankara kaldır');
    expect(onChange).toHaveBeenCalledWith([35]);
  });

  it('listede olmayan eski il kodu çipte "İl 999" olarak görünür', async () => {
    const { r } = await render([999]);
    expect(texts(r.root)).toContain('İl 999');
  });
});
