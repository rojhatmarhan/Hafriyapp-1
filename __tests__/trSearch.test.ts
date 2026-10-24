import { normalizeTr, trIncludes } from '../src/utils/trSearch';

describe('normalizeTr', () => {
  it('folds İ/I/ı/i to plain i without combining dots', () => {
    expect(normalizeTr('İstanbul')).toBe('istanbul');
    expect(normalizeTr('ISTANBUL')).toBe('istanbul');
    expect(normalizeTr('ıstanbul')).toBe('istanbul');
    expect(normalizeTr('istanbul')).toBe('istanbul');
    expect(normalizeTr('İ').includes('̇')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(normalizeTr(null)).toBe('');
    expect(normalizeTr(undefined)).toBe('');
  });

  it('keeps other Turkish letters', () => {
    expect(normalizeTr('ŞÇĞÖÜ')).toBe('şçğöü');
  });
});

describe('trIncludes', () => {
  it('matches across İ/i/I/ı variants on both sides', () => {
    expect(trIncludes('İzmir', 'izm')).toBe(true);
    expect(trIncludes('İzmir', 'İZM')).toBe(true);
    expect(trIncludes('Kırıkkale', 'kirik')).toBe(true);
    expect(trIncludes('kirikkale', 'KIRIK')).toBe(true);
    expect(trIncludes('Ankara', 'izm')).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(trIncludes('Ankara', '')).toBe(true);
    expect(trIncludes(null, '')).toBe(true);
  });
});
