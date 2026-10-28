import { getDumpStatus, formatDumpAmounts, formatDumpLine, formatDumpReceiptValue, formatJobDumpSummary } from '../src/utils/dumpFormat';

describe('getDumpStatus', () => {
  it('maps known statuses case/whitespace-insensitively', () => {
    expect(getDumpStatus({ dumpStatus: 'matched' })).toBe('matched');
    expect(getDumpStatus({ dumpStatus: ' Matched ' })).toBe('matched');
    expect(getDumpStatus({ dumpStatus: 'plateMismatch' })).toBe('plateMismatch');
    expect(getDumpStatus({ dumpStatus: 'PLATEMISMATCH' })).toBe('plateMismatch');
    expect(getDumpStatus({ dumpStatus: 'waiting' })).toBe('waiting');
    expect(getDumpStatus({ dumpStatus: 'Waiting' })).toBe('waiting');
  });

  it('returns null for unknown, empty or missing values (old API)', () => {
    expect(getDumpStatus({ dumpStatus: 'something' })).toBeNull();
    expect(getDumpStatus({ dumpStatus: '' })).toBeNull();
    expect(getDumpStatus({ dumpStatus: null })).toBeNull();
    expect(getDumpStatus({})).toBeNull();
    expect(getDumpStatus(null)).toBeNull();
    expect(getDumpStatus(undefined)).toBeNull();
  });
});

describe('formatDumpAmounts', () => {
  it('formats tonnes and fee in tr-TR with 2 decimals', () => {
    expect(formatDumpAmounts({ dumpNetKg: 26430, dumpFee: 4376.81 })).toBe('26,43 t · 4.376,81 ₺');
  });

  it('pads to 2 decimals', () => {
    expect(formatDumpAmounts({ dumpNetKg: 20000, dumpFee: 1500 })).toBe('20,00 t · 1.500,00 ₺');
  });

  it('skips missing parts', () => {
    expect(formatDumpAmounts({ dumpNetKg: 26430 })).toBe('26,43 t');
    expect(formatDumpAmounts({ dumpFee: 4376.81 })).toBe('4.376,81 ₺');
    expect(formatDumpAmounts({ dumpNetKg: null, dumpFee: null })).toBe('');
    expect(formatDumpAmounts({})).toBe('');
    expect(formatDumpAmounts(null)).toBe('');
  });

  it('ignores non-finite values', () => {
    expect(formatDumpAmounts({ dumpNetKg: NaN, dumpFee: Infinity })).toBe('');
  });

  it('keeps zero values', () => {
    expect(formatDumpAmounts({ dumpNetKg: 0, dumpFee: 0 })).toBe('0,00 t · 0,00 ₺');
  });
});

describe('formatDumpLine', () => {
  it('matched with amounts', () => {
    expect(formatDumpLine({ dumpStatus: 'matched', dumpNetKg: 26430, dumpFee: 4376.81 })).toEqual({ status: 'matched', text: 'Döküm: 26,43 t · 4.376,81 ₺', amountsText: '' });
  });

  it('matched without amounts', () => {
    expect(formatDumpLine({ dumpStatus: 'matched' })).toEqual({ status: 'matched', text: 'Döküm eşleşti', amountsText: '' });
  });

  it('plateMismatch with plate and amounts', () => {
    expect(formatDumpLine({ dumpStatus: 'plateMismatch', dumpPlate: ' 34ABC123 ', dumpNetKg: 26430, dumpFee: 4376.81 })).toEqual({
      status: 'plateMismatch',
      text: '⚠ Farklı plaka döküme girdi: 34ABC123',
      amountsText: 'Döküm: 26,43 t · 4.376,81 ₺',
    });
  });

  it('plateMismatch without plate or amounts', () => {
    expect(formatDumpLine({ dumpStatus: 'plateMismatch' })).toEqual({ status: 'plateMismatch', text: '⚠ Farklı plaka döküme girdi', amountsText: '' });
  });

  it('waiting ignores amounts', () => {
    expect(formatDumpLine({ dumpStatus: 'waiting', dumpNetKg: 26430 })).toEqual({ status: 'waiting', text: 'Döküm bekleniyor…', amountsText: '' });
  });

  it('returns null when status is absent or unknown', () => {
    expect(formatDumpLine({ dumpNetKg: 26430, dumpFee: 100 })).toBeNull();
    expect(formatDumpLine({ dumpStatus: 'foo' })).toBeNull();
    expect(formatDumpLine(null)).toBeNull();
    expect(formatDumpLine(undefined)).toBeNull();
  });
});

describe('formatDumpReceiptValue', () => {
  it('matched → amounts, or "Eşleşti" when amounts missing', () => {
    expect(formatDumpReceiptValue({ dumpStatus: 'matched', dumpNetKg: 26430, dumpFee: 4376.81 })).toBe('26,43 t · 4.376,81 ₺');
    expect(formatDumpReceiptValue({ dumpStatus: 'matched' })).toBe('Eşleşti');
  });

  it('plateMismatch → amounts + plate note', () => {
    expect(formatDumpReceiptValue({ dumpStatus: 'plateMismatch', dumpPlate: '34ABC123', dumpNetKg: 26430 })).toBe('26,43 t (Farklı plaka: 34ABC123)');
    expect(formatDumpReceiptValue({ dumpStatus: 'plateMismatch' })).toBe('Eşleşti (Farklı plaka)');
  });

  it('waiting / unknown / absent → null', () => {
    expect(formatDumpReceiptValue({ dumpStatus: 'waiting', dumpNetKg: 26430 })).toBeNull();
    expect(formatDumpReceiptValue({ dumpStatus: 'x' })).toBeNull();
    expect(formatDumpReceiptValue({})).toBeNull();
    expect(formatDumpReceiptValue(null)).toBeNull();
  });
});

describe('formatJobDumpSummary', () => {
  it('iş kartı satırları: ortalama dolu tonaj, toplam döküm, verisi alınamayan sefer', () => {
    expect(formatJobDumpSummary({ dumpAvgBrutKg: 42210, dumpTotalFee: 1243765.78, dumpMissingCount: 7 })).toEqual({
      avg: '42,2 Ton',
      total: '1.243.765,78₺',
      missing: '(7 seferin verisi alınamadı)',
    });
  });

  it('eşleşen kayıt yoksa ortalama, eksik sefer yoksa not gösterilmez', () => {
    expect(formatJobDumpSummary({ dumpAvgBrutKg: null, dumpTotalFee: 0, dumpMissingCount: 0 })).toEqual({ avg: null, total: '0,00₺', missing: null });
  });

  it('alan yoksa (eski API / döküm fişi girilmemiş) null', () => {
    expect(formatJobDumpSummary({})).toBeNull();
    expect(formatJobDumpSummary(null)).toBeNull();
  });
});
