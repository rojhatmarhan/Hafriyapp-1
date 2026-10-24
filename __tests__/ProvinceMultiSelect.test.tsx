import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import ProvinceMultiSelect from '../src/components/ProvinceMultiSelect';

type Instance = ReactTestRenderer.ReactTestInstance;

const textOf = (node: Instance | string): string => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

/** Metni birebir eşleşen Text'ten yukarı çıkıp ilk onPress sahibini basar. */
const pressByExactText = async (root: Instance, text: string) => {
  const target = root.findAllByType(Text).find(t => textOf(t) === text);
  if (!target) throw new Error(`"${text}" bulunamadı`);
  let node: Instance | null = target;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`"${text}" için basılabilir öğe yok`);
  const pressable = node;
  await ReactTestRenderer.act(async () => {
    pressable.props.onPress();
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

const openDropdown = (root: Instance) => pressByExactText(root, 'İl Ekle / Seç');

const search = async (root: Instance, q: string) => {
  const input = root.findByType(TextInput);
  await ReactTestRenderer.act(async () => {
    input.props.onChangeText(q);
  });
};

describe('ProvinceMultiSelect', () => {
  it('shows no selected header when nothing is selected and the dropdown is closed', async () => {
    const { r } = await render([]);
    expect(texts(r.root).some(t => t.startsWith('Seçili İller'))).toBe(false);
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('opening the dropdown lists cities; selecting one appends its code', async () => {
    const { r, onChange } = await render([6]);
    await openDropdown(r.root);
    expect(texts(r.root)).toContain('İl Seçimini Gizle');

    await pressByExactText(r.root, 'Adana');
    expect(onChange).toHaveBeenCalledWith([6, 1]);
  });

  it('keeps selection order (first selected stays first)', async () => {
    const { r, onChange } = await render([340, 6]);
    await openDropdown(r.root);
    await pressByExactText(r.root, 'Adana');
    expect(onChange).toHaveBeenLastCalledWith([340, 6, 1]);
  });

  it('does not list already-selected cities in the dropdown', async () => {
    const { r } = await render([1]);
    await openDropdown(r.root);
    expect(texts(r.root)).not.toContain('Adana');
    expect(texts(r.root)).toContain('Adana ✕');
  });

  it('pressing a selected chip removes that province', async () => {
    const { r, onChange } = await render([340, 6, 1]);
    expect(texts(r.root)).toContain('Seçili İller (3)');
    await pressByExactText(r.root, 'Ankara ✕');
    expect(onChange).toHaveBeenCalledWith([340, 1]);
  });

  it('"Temizle" clears all', async () => {
    const { r, onChange } = await render([6, 1]);
    await pressByExactText(r.root, 'Temizle');
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows unknown legacy codes as "İl N" so they can be removed', async () => {
    const { r, onChange } = await render([999, 6]);
    await pressByExactText(r.root, 'İl 999 ✕');
    expect(onChange).toHaveBeenCalledWith([6]);
  });

  it('filters the dropdown by search text', async () => {
    const { r, onChange } = await render([]);
    await openDropdown(r.root);
    await search(r.root, 'ank');
    const cityTexts = texts(r.root).filter(t => t === 'Ankara' || t === 'Adana');
    expect(cityTexts).toEqual(['Ankara']);
    await pressByExactText(r.root, 'Ankara');
    expect(onChange).toHaveBeenCalledWith([6]);
  });

  it('finds İzmir when the search is typed with "İ"', async () => {
    const { r } = await render([]);
    await openDropdown(r.root);
    await search(r.root, 'İzm');
    expect(texts(r.root)).toContain('İzmir');
  });

  // Eski hata: arama `toLowerCase()` ile yapılıyordu ('İzmir'.toLowerCase() === 'i̇zmir'); artık utils/trSearch kullanılıyor.
  it('finds İzmir / İstanbul when the search is typed with a plain "i"', async () => {
    const { r } = await render([]);
    await openDropdown(r.root);
    await search(r.root, 'izmir');
    expect(texts(r.root)).toContain('İzmir');
    await search(r.root, 'istanbul');
    expect(texts(r.root)).toContain('İstanbul (Avrupa)');
  });
});
