import reducer, { addPendingHaul, removePendingHaul, updatePendingHaul, clearPendingHauls, PendingHaul } from '../src/store/slices/pendingHaulSlice';

const makeHaul = (overrides: Partial<PendingHaul> = {}): PendingHaul => ({
  localId: 'a1',
  jobSiteId: 'js-1',
  plateNumber: '34ABC123',
  paymentType: 0,
  tonage: 0,
  cashAmount: 1500,
  fuelAmount: 0,
  dumpLocation: 'Kemerburgaz',
  note: '',
  dumpTicketNo: '12345',
  isPrintedReceipt: false,
  timeOfHaul: '2026-10-24T08:00:00.000Z',
  createdAt: '2026-10-24T08:00:01.000Z',
  ...overrides,
});

describe('pendingHaulSlice', () => {
  it('has an empty initial queue', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({ queue: [] });
  });

  it('adds hauls in order', () => {
    let state = reducer(undefined, addPendingHaul(makeHaul({ localId: 'a1' })));
    state = reducer(state, addPendingHaul(makeHaul({ localId: 'a2' })));
    expect(state.queue.map(h => h.localId)).toEqual(['a1', 'a2']);
    expect(state.queue[0].dumpTicketNo).toBe('12345');
  });

  it('accepts an old-format item without dumpTicketNo', () => {
    const { dumpTicketNo, ...old } = makeHaul({ localId: 'old' });
    expect(dumpTicketNo).toBe('12345');
    let state = reducer(undefined, addPendingHaul(old as PendingHaul));
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].dumpTicketNo).toBeUndefined();

    state = reducer(state, updatePendingHaul({ id: 'old', changes: { serialNumber: 'S-1' } }));
    expect(state.queue[0]).toEqual({ ...old, serialNumber: 'S-1' });

    state = reducer(state, updatePendingHaul({ id: 'old', changes: { dumpTicketNo: '99999' } }));
    expect(state.queue[0].dumpTicketNo).toBe('99999');

    state = reducer(state, removePendingHaul('old'));
    expect(state.queue).toEqual([]);
  });

  it('updates by localId, merging changes', () => {
    let state = reducer(undefined, addPendingHaul(makeHaul({ localId: 'a1' })));
    state = reducer(state, addPendingHaul(makeHaul({ localId: 'a2' })));
    state = reducer(state, updatePendingHaul({ id: 'a2', changes: { plateNumber: '06XYZ99', cashAmount: 2000 } }));
    expect(state.queue[1]).toMatchObject({ localId: 'a2', plateNumber: '06XYZ99', cashAmount: 2000, dumpLocation: 'Kemerburgaz' });
    expect(state.queue[0].plateNumber).toBe('34ABC123');
  });

  it('updates by "local_"-prefixed id as well', () => {
    let state = reducer(undefined, addPendingHaul(makeHaul({ localId: 'a1' })));
    state = reducer(state, updatePendingHaul({ id: 'local_a1', changes: { note: 'düzenlendi' } }));
    expect(state.queue[0].note).toBe('düzenlendi');
  });

  it('ignores update for unknown id', () => {
    const state = reducer(undefined, addPendingHaul(makeHaul()));
    const next = reducer(state, updatePendingHaul({ id: 'nope', changes: { note: 'x' } }));
    expect(next).toEqual(state);
  });

  it('removes by localId only', () => {
    let state = reducer(undefined, addPendingHaul(makeHaul({ localId: 'a1' })));
    state = reducer(state, addPendingHaul(makeHaul({ localId: 'a2' })));
    state = reducer(state, removePendingHaul('a1'));
    expect(state.queue.map(h => h.localId)).toEqual(['a2']);
    state = reducer(state, removePendingHaul('missing'));
    expect(state.queue).toHaveLength(1);
  });

  it('clears the queue', () => {
    let state = reducer(undefined, addPendingHaul(makeHaul()));
    state = reducer(state, clearPendingHauls());
    expect(state.queue).toEqual([]);
  });
});
