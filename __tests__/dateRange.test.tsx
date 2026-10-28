import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ddmmyyyyToKey, ddmmyyyyToYMD, isInDateRange, monthEndDDMMYYYY, monthStartDDMMYYYY, todayDDMMYYYY, useDateRange } from '../src/utils/dateRange';

describe('dateRange', () => {
  it('ay başı ve ay sonu geçerli tarihler', () => {
    expect(monthStartDDMMYYYY()).toMatch(/^01\.\d{2}\.\d{4}$/);
    const end = monthEndDDMMYYYY();
    expect(end).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    const [d, m, y] = end.split('.').map(Number);
    expect(new Date(y, m - 1, d).getMonth()).toBe(m - 1); // "31.11" gibi geçersiz gün olmaz
  });

  it('dönüşümler', () => {
    expect(ddmmyyyyToKey('05.10.2026')).toBe(20261005);
    expect(ddmmyyyyToKey('5.10.2026')).toBeNull();
    expect(ddmmyyyyToYMD('05.10.2026')).toBe('2026-10-05');
  });

  it('aralık uçları dahil', () => {
    const s = 20261001;
    const e = 20261031;
    expect(isInDateRange('2026-10-01T08:00:00', s, e)).toBe(true);
    expect(isInDateRange('2026-10-31T22:00:00', s, e)).toBe(true);
    expect(isInDateRange('2026-11-01T00:30:00', s, e)).toBe(false);
    expect(isInDateRange('2026-09-30T23:00:00', s, e)).toBe(false);
    expect(isInDateRange(undefined, s, e)).toBe(true);
  });

  it('başlangıç bitişten sonra seçilirse bitiş eşitlenir, sıfırlama bu aya döner', async () => {
    let api: ReturnType<typeof useDateRange> | null = null;
    const Probe = () => {
      api = useDateRange();
      return null;
    };
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Probe />);
    });
    expect(api!.isDefaultRange).toBe(true);

    await ReactTestRenderer.act(async () => {
      api!.changeStart('15.12.2030');
    });
    expect(api!.rangeStart).toBe('15.12.2030');
    expect(api!.rangeEnd).toBe('15.12.2030');
    expect(api!.isDefaultRange).toBe(false);

    await ReactTestRenderer.act(async () => {
      api!.changeEnd('01.12.2030');
    });
    expect(api!.rangeStart).toBe('01.12.2030');

    await ReactTestRenderer.act(async () => {
      api!.resetRange();
    });
    expect(api!.rangeStart).toBe(monthStartDDMMYYYY());
    expect(api!.rangeEnd).toBe(monthEndDDMMYYYY());
  });

  it('defaultAllTime: boş aralıkla açılır (filtre yok), bir uç seçilince diğeri dolar, sıfırlama tüm zamanlara döner', async () => {
    let api: ReturnType<typeof useDateRange> | null = null;
    const Probe = () => {
      api = useDateRange({ defaultAllTime: true });
      return null;
    };
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Probe />);
    });
    expect(api!.rangeStart).toBe('');
    expect(api!.rangeEnd).toBe('');
    expect(api!.startKey).toBeNull();
    expect(api!.endKey).toBeNull();
    expect(api!.isDefaultRange).toBe(true);
    expect(isInDateRange('2020-01-05T10:00:00', api!.startKey, api!.endKey)).toBe(true);

    // Başlangıç seçilince bitiş bugün olur
    await ReactTestRenderer.act(async () => {
      api!.changeStart('01.01.2026');
    });
    expect(api!.rangeEnd).toBe(todayDDMMYYYY());
    expect(api!.isDefaultRange).toBe(false);

    await ReactTestRenderer.act(async () => {
      api!.resetRange();
    });
    expect(api!.rangeStart).toBe('');
    expect(api!.rangeEnd).toBe('');

    // Bitiş seçilince başlangıç aynı gün olur
    await ReactTestRenderer.act(async () => {
      api!.changeEnd('10.10.2026');
    });
    expect(api!.rangeStart).toBe('10.10.2026');
    expect(api!.rangeEnd).toBe('10.10.2026');
  });
});
