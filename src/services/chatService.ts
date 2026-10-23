import axios from 'axios';
import { api } from './api';

export const getChatGroups = async (token: string, provinceCode?: number, page: number = 1, pageSize: number = 20, search?: string) => {
    try {
        const params: Record<string, any> = { page, pageSize };
        if (provinceCode != null) params.provinceCode = provinceCode;
        if (search && search.trim()) params.search = search.trim();

        const response = await api.get(`/ChatGroup`, {
            params,
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching chat groups:', error);
        throw error;
    }
};

export const createChatGroup = async (token: string, payload: any) => {
    try {
        const response = await api.post(`/ChatGroup`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error creating chat group:', error);
        throw error;
    }
};

// API cevabı: { data: { messages: [eskiden → yeniye], hasMore, nextCursor (sayfadaki en eski mesajın id'si) } }
// before verilirse o mesajdan daha eski mesajlar döner (cursor tabanlı sayfalama).
export const getGroupMessages = async (token: string, groupId: string, before?: string | null, pageSize: number = 50) => {
    try {
        const params: Record<string, any> = { pageSize };
        if (before) params.before = before;
        const response = await api.get(`/ChatGroup/${groupId}/messages`, {
            params,
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

export const sendMessage = async (token: string, groupId: string, content: string) => {
    try {
        const response = await api.post(`/ChatGroup/${groupId}/messages`, { content }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

export const getGroupDetail = async (token: string, id: string) => {
    const response = await api.get(`/ChatGroup/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const updateGroupSettings = async (token: string, id: string, data: { name?: string; description?: string; provinceCode?: number; provinceCodes?: number[] }) => {
    const response = await api.put(`/ChatGroup/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const uploadGroupImage = async (token: string, id: string, base64Image: string) => {
    const response = await api.post(`/ChatGroup/${id}/upload-image`, { base64Image }, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const deleteGroup = async (token: string, id: string) => {
    const response = await api.delete(`/ChatGroup/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const getBlockedPhones = async (token: string, id: string) => {
    const response = await api.get(`/ChatGroup/${id}/blocked-phones`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const addBlockedPhone = async (token: string, id: string, phoneNumber: string) => {
    const response = await api.post(`/ChatGroup/${id}/blocked-phones`, { phoneNumber }, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const removeBlockedPhone = async (token: string, id: string, phoneNumber: string) => {
    const response = await api.delete(`/ChatGroup/${id}/blocked-phones`, {
        params: { phoneNumber },
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};

export const markGroupAsRead = async (token: string, groupId: string) => {
    try {
        const response = await api.post(`/ChatGroup/${groupId}/read`, {}, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        console.warn('Error marking group as read:', error);
        return null;
    }
};

export const deleteMessage = async (token: string, groupId: string, messageId: string) => {
    const response = await api.delete(`/ChatGroup/${groupId}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};


// Grubu üstte sabitle / sabitlemeyi kaldır (sunucuda, kullanıcıya özel). Uç durumu tersine çevirir.
// Cevap Result<bool>: { isSuccess, data: yeni isPinned }. Üye değilse sunucu kullanıcıyı üye yapıp sabitler.
export const toggleChatGroupPin = async (token: string, groupId: string) => {
    const response = await api.post(`/ChatGroup/${groupId}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
};
