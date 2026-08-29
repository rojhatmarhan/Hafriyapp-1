import { api } from './api';

export type HaulApi = {
  id: string;
  vehicleId?: string;
  jobSiteId: string;
  jobSiteName: string;
  companyName?: string;
  companyLogoPath?: string;
  contactPhone?: string;
  plateNumber: string;
  serialNumber?: string;
  note?: string;
  driverName?: string;
  driverPhone?: string;
  timeOfHaul: string;
  dumpLocation: string;
  tonage: number;
  cashAmount: number;
  fuelAmount: number;
  isPaid: boolean;
  isPrintedReceipt: boolean;
  paymentType: number; // 0=Nakit, 1=Yakıt, 2=İkisi
  qrCodeBase64?: string;
  offer1Name?: string;
  offer1Cash?: number;
  offer1Fuel?: number;
  offer2Name?: string;
  offer2Cash?: number;
  offer2Fuel?: number;
  createdDate: string;
  updatedDate?: string;
  isVisibleToVehicleOwner: boolean;
};

// Tüm seferleri getir (kullanıcıya ait araçların seferleri)
export const getHauls = async (token: string): Promise<HaulApi[]> => {
  const res = await api.get('/Haul/my/filtered', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
};

// Tarih aralığına göre filtreli seferleri getir
export const getHaulsFiltered = async (
  token: string,
  startDate: string,
  endDate: string,
): Promise<HaulApi[]> => {
  const res = await api.get('/Haul/my/filtered', {
    params: { startDate, endDate },
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
};

// Plakadan araç ID'si bul
const getVehicleIdByPlate = async (plate: string, token: string): Promise<string | null> => {
  try {
    const normalized = plate.replace(/\s/g, '').toUpperCase();
    const res = await api.get(`/Vehicle/by-plate/${normalized}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    return res.data?.id ?? null;
  } catch {
    return null;
  }
};

// Araca özel seferleri getir
export const getHaulsByVehicle = async (vehicleId: string, token: string): Promise<HaulApi[]> => {
  const res = await api.get(`/Haul/vehicle/${vehicleId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return res.data;
};

export type CreateHaulParams = {
  jobSiteId: string;
  plateNumber: string;
  paymentType: number; // 0=Nakit, 1=Yakıt, 2=Her ikisi
  tonage?: number;
  cashAmount?: number;
  fuelAmount?: number;
  dumpLocation?: string;
  note?: string;
  timeOfHaul?: string; // ISO, yoksa şu an
  isPrintedReceipt?: boolean;
  isVisibleToVehicleOwner?: boolean;
  clientUniqueId?: string;
};

// Yeni sefer oluştur
export const createHaul = async (params: CreateHaulParams, token: string): Promise<HaulApi> => {
  const normalizedPlate = params.plateNumber.replace(/\s/g, '').toUpperCase();
  const vehicleId = await getVehicleIdByPlate(normalizedPlate, token);

  const res = await api.post(
    '/Haul',
    {
      jobSiteId: params.jobSiteId,
      vehicleId: vehicleId ?? undefined,
      plateNumber: normalizedPlate,
      paymentType: params.paymentType,
      tonage: params.tonage ?? 0,
      cashAmount: params.cashAmount ?? 0,
      fuelAmount: params.fuelAmount ?? 0,
      dumpLocation: params.dumpLocation ?? '',
      note: params.note ?? '',
      timeOfHaul: params.timeOfHaul ?? new Date().toISOString(),
      isPaid: false,
      isPrintedReceipt: params.isPrintedReceipt ?? false,
      isVisibleToVehicleOwner: params.isVisibleToVehicleOwner ?? true,
      clientUniqueId: params.clientUniqueId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  );
  return res.data;
};

export type UpdateHaulPaymentParams = {
  haulId: string;
  isPaid: boolean;
  paymentType?: number;
  cashAmount?: number;
  fuelAmount?: number;
  tonage?: number;
  dumpLocation?: string;
};

// Sefer ödeme durumunu güncelle
export const updateHaulPayment = async (
  params: UpdateHaulPaymentParams,
  token: string,
): Promise<void> => {
  await api.patch(
    `/Haul/${params.haulId}/payment`,
    {
      isPaid: params.isPaid,
      paymentType: params.paymentType,
      cashAmount: params.cashAmount,
      fuelAmount: params.fuelAmount,
      tonage: params.tonage,
      dumpLocation: params.dumpLocation,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  );
};

export const deleteHaul = async (haulId: string, token: string): Promise<void> => {
  await api.delete(`/Haul/${haulId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
};

export type UpdateHaulParams = {
  plateNumber?: string;
  dumpLocation?: string;
  tonage?: number;
  cashAmount?: number;
  fuelAmount?: number;
  note?: string;
  serialNumber?: string;
};

// Seferi düzenle (Sadece Owner)
export const updateHaul = async (
  haulId: string,
  params: UpdateHaulParams,
  token: string,
): Promise<void> => {
  await api.put(`/Haul/${haulId}`, params, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
};

// Tekil sefer getir
export const getHaulById = async (token: string, haulId: string): Promise<HaulApi | null> => {
  try {
    const res = await api.get(`/Haul/${haulId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    return res.data;
  } catch {
    return null;
  }
};


