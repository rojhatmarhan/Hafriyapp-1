import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type PendingHaul = {
  localId: string;           // yerel takip için benzersiz id
  jobSiteId: string;
  plateNumber: string;
  paymentType: number;       // 0=Nakit, 1=Yakıt, 2=Her ikisi
  tonage: number;
  cashAmount: number;
  fuelAmount: number;
  dumpLocation: string;
  note: string;
  isPrintedReceipt: boolean;
  serialNumber?: string;     // Çevrimdışı kesilen fişin sıralı/benzersiz seri no'su
  timeOfHaul: string;        // ISO string — sefer anı
  createdAt: string;         // kuyruğa eklenme zamanı
};

interface PendingHaulState {
  queue: PendingHaul[];
}

const initialState: PendingHaulState = {
  queue: [],
};

const pendingHaulSlice = createSlice({
  name: 'pendingHaul',
  initialState,
  reducers: {
    addPendingHaul(state, action: PayloadAction<PendingHaul>) {
      state.queue.push(action.payload);
    },
    removePendingHaul(state, action: PayloadAction<string>) {
      state.queue = state.queue.filter(h => h.localId !== action.payload);
    },
    updatePendingHaul(state, action: PayloadAction<{ id: string; changes: Partial<PendingHaul> }>) {
      const idx = state.queue.findIndex(h => h.localId === action.payload.id || `local_${h.localId}` === action.payload.id);
      if (idx !== -1) {
        state.queue[idx] = { ...state.queue[idx], ...action.payload.changes };
      }
    },
    clearPendingHauls(state) {
      state.queue = [];
    },
  },
});

export const { addPendingHaul, removePendingHaul, updatePendingHaul, clearPendingHauls } =
  pendingHaulSlice.actions;
export default pendingHaulSlice.reducer;
