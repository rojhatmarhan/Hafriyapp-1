import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  companyId: string; // Add companyId
  companyName: string
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumberConfirmed: boolean;
  createdDate: string;
  userType: number;
  accessMode?: number;
  accessRestrictionNote?: string | null;
  warningMessage?: string | null;
  warningExpireDate?: string | null;
}
interface AuthState {
  role: 'driver' | 'supplier' | null;
  phone: string;
  token: string | null;
  isLoggedIn: boolean;
  user: User | null;
  companyId: string | null;
}

const initialState: AuthState = {
  role: null,
  phone: '',
  token: null,
  isLoggedIn: false,
  user: null,
  companyId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setRole(state, action: PayloadAction<AuthState['role']>) {
      state.role = action.payload;
    },
    setPhone(state, action: PayloadAction<string>) {
      state.phone = action.payload;
    },
    setCompanyId(state, action: PayloadAction<string | null>) {
      state.companyId = action.payload;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loginSuccess(state, action: PayloadAction<{ token: string }>) {
      state.token = action.payload.token;
      state.isLoggedIn = true;
    },
    logout(state) {
      state.token = null;
      state.isLoggedIn = false;
      state.phone = '';
      state.role = null;
      state.user = null; // Clear user data
      state.companyId = null;
    },
  },
});

export const { setRole, setPhone, loginSuccess, logout, setUser, setCompanyId } =
  authSlice.actions;
export default authSlice.reducer;
