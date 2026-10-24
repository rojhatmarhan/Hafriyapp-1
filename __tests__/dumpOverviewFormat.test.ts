import { dumpSourceLabel, dumpSourceTitle, getDumpMatchStatus, dumpStatusColor, formatTL, formatKg, formatTonnes, formatFee, formatDumpDateTime, buildDumpQuery, parseTurkishAmount, isValidDDMMYYYY, depositDateToIso, formatBalanceSubtext } from '../src/utils/dumpFormat';

describe('dumpSourceLabel / dumpSourceTitle', () => {
  it('maps API formats to display names', () => {
    expect(dumpSourceLabel('Kig')).toBe('Cebeci');
    expect(dumpSourceLabel('KIG')).toBe('Cebeci');
    expect(dumpSourceLabel('Istac')).toBe('İSTAÇ');
    expect(dumpSourceLabel('Unknown')).toBe('');
    expect(dumpSourceLabel(null)).toBe('');
  });

  it('builds selector titles', () => {
    expect(dumpSourceTitle('')).toBe('Tüm Dökümler Özet');
    expect(dumpSourceTitle('Kig')).toBe('Cebeci Dökümü Özet');
    expect(dumpSourceTitle('Istac')).toBe('İSTAÇ Dökümü Özet');
  });
});

describe('getDumpMatchStatus / dumpStatusColor', () => {
  it('normalizes status, unknown → unmatched', () => {
    expect(getDumpMatchStatus('matched')).toBe('matched');
    expect(getDumpMatchStatus(' PlateMismatch ')).toBe('plateMismatch');
    expect(getDumpMatchStatus('unmatched')).toBe('unmatched');
    expect(getDumpMatchStatus('foo')).toBe('unmatched');
    expect(getDumpMatchStatus(undefined)).toBe('unmatched');
  });

  it('returns strip colors', () => {
    expect(dumpStatusColor('matched')).toBe('#2E7D32');
    expect(dumpStatusColor('plateMismatch')).toBe('#C62828');
    expect(dumpStatusColor('unmatched')).toBe('#BDBDBD');
  });
});

describe('number formatting (tr-TR)', () => {
  it('formatTL', () => {
    expect(formatTL(4376.81)).toBe('4.376,81₺');
    expect(formatTL(1500)).toBe('1.500,00₺');
    expect(formatTL(null)).toBe('0,00₺');
    expect(formatTL('12.5')).toBe('12,50₺');
  });

  it('formatKg (no decimals)', () => {
    expect(formatKg(28390.4)).toBe('28.390 kg');
    expect(formatKg(0)).toBe('0 kg');
    expect(formatKg(undefined)).toBe('0 kg');
  });

  it('formatTonnes / formatFee', () => {
    expect(formatTonnes(26430)).toBe('26,43');
    expect(formatTonnes(null)).toBe('-');
    expect(formatFee(4376.81)).toBe('4.376,81');
    expect(formatFee(NaN)).toBe('-');
  });
});

describe('formatDumpDateTime', () => {
  it('reads local (no offset) timestamps as-is', () => {
    expect(formatDumpDateTime('2026-10-05T14:07:33')).toEqual({ date: '05.10.2026', time: '14:07' });
    expect(formatDumpDateTime('2026-10-05 08:30')).toEqual({ date: '05.10.2026', time: '08:30' });
    expect(formatDumpDateTime('2026-10-05')).toEqual({ date: '05.10.2026', time: '' });
  });

  it('converts UTC timestamps to Turkey time (UTC+3)', () => {
    expect(formatDumpDateTime('2026-10-05T22:15:00Z')).toEqual({ date: '06.10.2026', time: '01:15' });
  });

  it('handles empty / invalid values', () => {
    expect(formatDumpDateTime(null)).toEqual({ date: '-', time: '' });
    expect(formatDumpDateTime('abc')).toEqual({ date: 'abc', time: '' });
  });
});

describe('buildDumpQuery', () => {
  it('skips empty values and encodes', () => {
    expect(buildDumpQuery({ companyId: 'c1', source: '', startDate: '2026-10-01', endDate: '2026-10-31', jobSiteId: null, search: '  34 ABC ', page: 2, pageSize: 30 })).toBe('companyId=c1&startDate=2026-10-01&endDate=2026-10-31&search=34%20ABC&page=2&pageSize=30');
  });

  it('includes source and jobSiteId when set', () => {
    expect(buildDumpQuery({ companyId: 'c1', source: 'Istac', jobSiteId: 'j1' })).toBe('companyId=c1&source=Istac&jobSiteId=j1');
  });
});

describe('parseTurkishAmount', () => {
  it('accepts Turkish comma decimals and thousand dots', () => {
    expect(parseTurkishAmount('150.000,50')).toBe(150000.5);
    expect(parseTurkishAmount('150000,5')).toBe(150000.5);
    expect(parseTurkishAmount('1.234.567,89')).toBe(1234567.89);
    expect(parseTurkishAmount('150.000')).toBe(150000);
    expect(parseTurkishAmount('150000')).toBe(150000);
    expect(parseTurkishAmount(' 2.500 ₺')).toBe(2500);
    expect(parseTurkishAmount('2500 TL')).toBe(2500);
    expect(parseTurkishAmount('1.5')).toBe(1.5);
    expect(parseTurkishAmount(',5')).toBe(0.5);
    expect(parseTurkishAmount('10,555')).toBe(10.56);
  });

  it('rejects empty / invalid input', () => {
    expect(parseTurkishAmount('')).toBeNull();
    expect(parseTurkishAmount('   ')).toBeNull();
    expect(parseTurkishAmount(null)).toBeNull();
    expect(parseTurkishAmount('abc')).toBeNull();
    expect(parseTurkishAmount('1,2,3')).toBeNull();
    expect(parseTurkishAmount('1.2.3')).toBeNull();
    expect(parseTurkishAmount('15.00.000,5')).toBeNull();
    expect(parseTurkishAmount('-500')).toBeNull();
    expect(parseTurkishAmount(',')).toBeNull();
  });

  it('returns 0 for zero (caller enforces > 0)', () => {
    expect(parseTurkishAmount('0')).toBe(0);
    expect(parseTurkishAmount('0,00')).toBe(0);
  });
});

describe('deposit date helpers', () => {
  it('validates DD.MM.YYYY calendar days', () => {
    expect(isValidDDMMYYYY('24.10.2026')).toBe(true);
    expect(isValidDDMMYYYY('29.02.2028')).toBe(true);
    expect(isValidDDMMYYYY('29.02.2026')).toBe(false);
    expect(isValidDDMMYYYY('31.11.2026')).toBe(false);
    expect(isValidDDMMYYYY('00.10.2026')).toBe(false);
    expect(isValidDDMMYYYY('24.13.2026')).toBe(false);
    expect(isValidDDMMYYYY('2026-10-24')).toBe(false);
    expect(isValidDDMMYYYY('')).toBe(false);
  });

  it('converts to ISO UTC at Turkey noon (no day shift)', () => {
    expect(depositDateToIso('24.10.2026')).toBe('2026-10-24T09:00:00.000Z');
    expect(depositDateToIso('31.02.2026')).toBeUndefined();
    expect(formatDumpDateTime(depositDateToIso('01.11.2026')).date).toBe('01.11.2026');
  });
});

describe('formatBalanceSubtext', () => {
  it('formats deposited and spent totals', () => {
    expect(formatBalanceSubtext(150000, 4376.81)).toBe('Yatırılan 150.000,00₺ · Harcanan 4.376,81₺');
    expect(formatBalanceSubtext(undefined, null)).toBe('Yatırılan 0,00₺ · Harcanan 0,00₺');
  });

  it('formatTL keeps the minus sign for negative balances', () => {
    expect(formatTL(-1250.5)).toBe('-1.250,50₺');
  });
});
