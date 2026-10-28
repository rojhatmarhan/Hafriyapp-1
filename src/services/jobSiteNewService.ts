import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAULS_VISIBILITY_KEY = 'jobsite_hauls_visibility';

export const getJobSites = async (token: string) => {
  const res = await api.get('/JobSite', {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};

export const saveHaulsVisibility = async (jobSiteId: string, value: boolean) => {
  try {
    const raw = await AsyncStorage.getItem(HAULS_VISIBILITY_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[jobSiteId] = value;
    await AsyncStorage.setItem(HAULS_VISIBILITY_KEY, JSON.stringify(map));
  } catch { }
};

export const getHaulsVisibility = async (jobSiteId: string): Promise<boolean | undefined> => {
  try {
    const raw = await AsyncStorage.getItem(HAULS_VISIBILITY_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return jobSiteId in map ? map[jobSiteId] : undefined;
  } catch {
    return undefined;
  }
};

export const createJobSite = async (token: string, data: any) => {
  console.log('[createJobSite] payload:', JSON.stringify(data, null, 2));
  const res = await api.post('/JobSite', data, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: '*/*',
    },
  });
  if (res.data?.id) {
    await saveHaulsVisibility(res.data.id, data.IsHaulVisibleToVehicleOwners ?? data.ShowHaulsToVehicleOwners ?? true);
  }
  return res.data;
};

export const updateJobSite = async (token: string, id: string, data: any) => {
  const res = await api.put(`/JobSite/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: '*/*',
    },
  });
  await saveHaulsVisibility(id, data.isHaulVisibleToVehicleOwners ?? data.showHaulsToVehicleOwners ?? true);
  return res.data;
};

export const toggleJobSiteActive = async (
  token: string,
  id: string,
  isActive: boolean,
) => {
  const res = await api.put(
    `/JobSite/${id}/toggle-active?isActive=${isActive}`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: '*/*',
      },
    },
  );
  return res.data;
};

export const deleteJobSite = async (token: string, id: string) => {
  const res = await api.delete(`/JobSite/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};

export const forceDeleteJobSite = async (token: string, id: string) => {
  const res = await api.delete(`/JobSite/${id}/force`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};

export const getJobSite = async (token: string, jobSiteId: string) => {
  const res = await api.get(`/JobSite/${jobSiteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};

export const getJobHauls = async (token: string, jobSiteId: string) => {
  const res = await api.get(`/Haul/jobsite/${jobSiteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};

export interface JobSiteNoteItem {
  id: string;
  jobSiteId: string;
  userId: string;
  userName: string;
  noteType: number; // 0 = General, 1 = FuelGiven, 2 = Expense, 3 = Overtime (Mesai)
  amount?: number;
  description: string;
  /** Mesai süresi (sadece noteType 3; serbest metin). Eski API'de yok. */
  overtimeDuration?: string | null;
  createdDate: string;
  canManage: boolean;
}

export const getJobSiteNotes = async (token: string, jobSiteId: string): Promise<JobSiteNoteItem[]> => {
  const res = await api.get(`/JobSite/${jobSiteId}/notes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const createJobSiteNote = async (
  token: string,
  jobSiteId: string,
  data: { noteType: number; amount?: number; description: string; overtimeDuration?: string },
) => {
  const res = await api.post(`/JobSite/${jobSiteId}/notes`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const updateJobSiteNote = async (
  token: string,
  jobSiteId: string,
  noteId: string,
  data: { amount?: number; description: string; overtimeDuration?: string },
) => {
  const res = await api.put(`/JobSite/${jobSiteId}/notes/${noteId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const deleteJobSiteNote = async (token: string, jobSiteId: string, noteId: string) => {
  const res = await api.delete(`/JobSite/${jobSiteId}/notes/${noteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};


// İşi başa tutturma (kullanıcıya özel). Uç her çağrıda durumu tersine çevirir.
// Cevap: { isPinned: boolean, message: string } — eski API'de uç yoksa 404 fırlatır (ekran pin özelliğini zaten gizler).
export const toggleJobSitePin = async (token: string, id: string): Promise<{ isPinned?: boolean; message?: string }> => {
  const res = await api.post(`/JobSite/${id}/pin`, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: '*/*',
    },
  });
  return res.data;
};
