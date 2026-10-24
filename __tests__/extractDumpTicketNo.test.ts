import { extractDumpTicketNo } from '../src/components/DumpTicketInput';

describe('extractDumpTicketNo', () => {
  it('extracts the number from Aztec "12345-..." codes', () => {
    expect(extractDumpTicketNo('12345-ABC')).toBe('12345');
    expect(extractDumpTicketNo('0012345678-XYZ-99')).toBe('0012345678');
  });

  it('keeps plain text as-is (trimmed)', () => {
    expect(extractDumpTicketNo('  ABC123  ')).toBe('ABC123');
    expect(extractDumpTicketNo('987654')).toBe('987654');
  });

  it('does not treat short numeric prefixes (<5 digits) as Aztec', () => {
    expect(extractDumpTicketNo('1234-ABC')).toBe('1234-ABC');
  });

  it('trims before matching the Aztec pattern', () => {
    expect(extractDumpTicketNo('  12345-ABC ')).toBe('12345');
  });

  it('caps result at 50 characters', () => {
    const long = 'X'.repeat(80);
    expect(extractDumpTicketNo(long)).toHaveLength(50);
    expect(extractDumpTicketNo('1'.repeat(60) + '-A')).toBe('1'.repeat(50));
  });

  it('returns empty string for empty/null/undefined', () => {
    expect(extractDumpTicketNo('')).toBe('');
    expect(extractDumpTicketNo('   ')).toBe('');
    expect(extractDumpTicketNo(null)).toBe('');
    expect(extractDumpTicketNo(undefined)).toBe('');
    expect(extractDumpTicketNo()).toBe('');
  });
});
