import { configureStore, combineReducers } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistReducer, persistStore } from 'redux-persist';

import counterReducer from './slices/counterSlice';
import authReducer from './slices/authSlice';
import pendingHaulReducer from './slices/pendingHaulSlice';
import uiReducer from './slices/uiSlice';

const rootReducer = combineReducers({
  counter: counterReducer,
  auth: authReducer,
  pendingHaul: pendingHaulReducer,
  ui: uiReducer,
});

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'counter', 'pendingHaul', 'ui'], // offline seferleri de sakla
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // redux-persist için şart
    }),
});

export const persistor = persistStore(store);

// RootState artık hem counter hem auth'u içeriyor
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
