import { normalizeDumpBalances, formatSinceNote, utcToIstanbul, dumpFilterTitle, normalizeCebeciStatus, formatCebeciLastData, buildCebeciRequestRange } from '../src/utils/dumpFormat';
import { isDumpNotification } from '../src/utils/notificationRoute';

describe('normalizeDumpBalances', () => {
  it('eski API (alan yok) → null', () => {
    expect(normalizeDumpBalances(undefined)).toBeNull();
    expect(normalizeDumpBalances(null)).toBeNull();
    expect(normalizeDumpBalances({})).toBeNull();
  });

  it('Cebeci önce, İSTAÇ sonra; bilinmeyen saha ve tekrar atlanır; sayılar güvenli', () => {
    const list = normalizeDumpBalances([
      { source: 'Istac', sourceName: 'İSTAÇ', hasDeposits: true, totalDeposits: 1000, totalFees: 250.5, balance: 749.5, since: '2026-11-01T09:00:00Z' },
      { source: 'Kig', hasDeposits: false, totalDeposits: '0', totalFees: null, balance: undefined, since: null },
      { source: 'Unknown', balance: 5 },
      { source: 'kig', balance: 99 },
    ]);
    expect(list).toEqual([
      { source: 'Kig', sourceName: 'Cebeci', hasDeposits: false, totalDeposits: 0, totalFees: 0, balance: 0, since: null },
      { source: 'Istac', sourceName: 'İSTAÇ', hasDeposits: true, totalDeposits: 1000, totalFees: 250.5, balance: 749.5, since: '2026-11-01T09:00:00Z' },
    ]);
  });
});

describe('utcToIstanbul / formatSinceNote', () => {
  it('UTC → İstanbul (+3); saat dilimi yazılmamışsa da UTC sayılır', () => {
    expect(utcToIstanbul('2026-11-11T21:30:00Z')).toEqual({ date: '12.11.2026', time: '00:30' });
    expect(utcToIstanbul('2026-11-11T21:30:00')).toEqual({ date: '12.11.2026', time: '00:30' });
    expect(utcToIstanbul('2026-11-11T21:30:00.123+00:00')).toEqual({ date: '12.11.2026', time: '00:30' });
    expect(utcToIstanbul('')).toBeNull();
    expect(utcToIstanbul('bozuk')).toBeNull();
  });

  it('since notu', () => {
    expect(formatSinceNote('2026-11-05T09:00:00Z')).toBe('05.11.2026 tarihinden itibaren');
    expect(formatSinceNote(null)).toBe('');
  });
});

describe('dumpFilterTitle', () => {
  it('durum seçiliyse durum adı, değilse iş adı ya da varsayılan', () => {
    expect(dumpFilterTitle('unmatched', 'Okul')).toBe('Eşleşmeyen');
    expect(dumpFilterTitle('plateMismatch', null)).toBe('Farklı plaka');
    expect(dumpFilterTitle('', 'Okul İnşaatı')).toBe('İş: Okul İnşaatı');
    expect(dumpFilterTitle('', null)).toBe('İşe Göre Filtrele');
  });
});

describe('Cebeci yardımcıları', () => {
  it('durum normalize', () => {
    expect(normalizeCebeciStatus('active')).toBe('active');
    expect(normalizeCebeciStatus('Pending')).toBe('pending');
    expect(normalizeCebeciStatus('disconnectPending')).toBe('disconnectPending');
    expect(normalizeCebeciStatus(undefined)).toBe('notConnected');
    expect(normalizeCebeciStatus('baska')).toBe('notConnected');
  });

  it('son veri metni (İstanbul saati)', () => {
    expect(formatCebeciLastData('2026-11-11T11:05:00Z')).toBe('Son veri: 11.11.2026 14:05');
    expect(formatCebeciLastData(null)).toBe('Henüz veri gelmedi');
  });

  it('talep tarihleri', () => {
    expect(buildCebeciRequestRange('today', '', '', '')).toEqual({});
    expect(buildCebeciRequestRange('day', '05.11.2026', '', '')).toEqual({ startDate: '2026-11-05', endDate: '2026-11-05' });
    expect(buildCebeciRequestRange('range', '', '10.11.2026', '01.11.2026')).toEqual({ startDate: '2026-11-01', endDate: '2026-11-10' });
    expect(buildCebeciRequestRange('day', '31.02.2026', '', '').error).toBeTruthy();
    expect(buildCebeciRequestRange('range', '', '', '01.11.2026').error).toBeTruthy();
  });
});

describe('isDumpNotification', () => {
  it('döküm ve Cebeci bildirimleri Döküm ekranına gider', () => {
    expect(isDumpNotification({ type: 'cebeci_status' })).toBe(true);
    expect(isDumpNotification({ type: 'cebeci_data', importId: 'x' })).toBe(true);
    expect(isDumpNotification({ type: 'dump_plate_mismatch' })).toBe(true);
    expect(isDumpNotification({ type: 'haul_created' })).toBe(false);
    expect(isDumpNotification(undefined)).toBe(false);
  });
});
