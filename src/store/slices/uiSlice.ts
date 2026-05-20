import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  selectedCity: number | null; // null = Tüm Türkiye
}

const initialState: UiState = {
  selectedCity: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedCity(state, action: PayloadAction<number | null>) {
      state.selectedCity = action.payload;
    },
  },
});

export const { setSelectedCity } = uiSlice.actions;
export default uiSlice.reducer;
