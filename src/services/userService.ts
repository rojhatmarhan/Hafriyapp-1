import { api } from './api';

export const getProfile = async (token: string) => {
  try {
    const res = await api.get('/User/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ GET PROFILE RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ GET PROFILE ERROR', error);
    throw error;
  }
};

export const getUserById = async (
  userId: string,
  token: string,
) => {
  try {
    const res = await api.get(`/User/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('✅ GET USER RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ GET USER ERROR', error);
    throw error;
  }
};

export const updateUserProfile = async (
  payload: { firstName?: string; lastName?: string; companyName?: string; profilePhotoBase64?: string },
  token: string,
) => {
  try {
    const res = await api.put('/User/profile', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ UPDATE PROFILE RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ UPDATE PROFILE ERROR', error);
    throw error;
  }
};

export const deleteAccount = async (token: string, reason?: string) => {
  try {
    const res = await api.delete('/User/account', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { reason },
    });
    console.log('✅ DELETE ACCOUNT RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ DELETE ACCOUNT ERROR', error);
    throw error;
  }
};

export const deactivateAccount = async (token: string) => {
  try {
    const res = await api.post('/User/account/deactivate', {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ DEACTIVATE ACCOUNT RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ DEACTIVATE ACCOUNT ERROR', error);
    throw error;
  }
};

export const getMyCompanies = async (token: string) => {
  try {
    const res = await api.get('/company', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ GET COMPANIES RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ GET COMPANIES ERROR', error);
    throw error;
  }
};

export const getCompanyById = async (companyId: string, token: string) => {
  try {
    const res = await api.get(`/company/${companyId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ GET COMPANY BY ID RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ GET COMPANY BY ID ERROR', error);
    throw error;
  }
};

export const addAuthorizedUser = async (
  companyId: string,
  payload: { phoneNumber: string; firstName: string; lastName: string },
  token: string
) => {
  try {
    const res = await api.post(`/company/${companyId}/authorized-user`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ ADD AUTHORIZED USER RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ ADD AUTHORIZED USER ERROR', error);
    throw error;
  }
};

export const removeAuthorizedUser = async (companyId: string, userId: string, token: string) => {
  try {
    const res = await api.delete(`/company/${companyId}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ REMOVE AUTHORIZED USER RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ REMOVE AUTHORIZED USER ERROR', error);
    throw error;
  }
};

export const updateCompanyDetails = async (
  companyId: string,
  payload: { name?: string; phoneNumber?: string; address?: string; taxNumber?: string; logoPath?: string },
  token: string
) => {
  try {
    const res = await api.put(`/company/${companyId}`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('✅ UPDATE COMPANY DETAILS RESPONSE', res.data);
    return res.data;
  } catch (error) {
    console.log('❌ UPDATE COMPANY DETAILS ERROR', error);
    throw error;
  }
};
