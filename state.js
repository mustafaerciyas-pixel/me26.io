/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Kurşun Geçirmez Sürüm - Çökme Korumalı + Canlı Yayın (Production)
   ========================================================================== */

// Sistemin hafızaya kayıt anahtarı
const STORAGE_KEY = 'me26_user';
const SESSION_CHANNEL_NAME = 'me26_session_sync';
const SESSION_CHANNEL = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(SESSION_CHANNEL_NAME) : null;

const broadcastState = (action, payload = null) => {
    try {
        SESSION_CHANNEL?.postMessage({ action, payload, ts: Date.now() });
    } catch (error) {
        console.warn('Sekme senkronizasyon mesajı gönderilemedi:', error);
    }
};

// 1. GÜVENLİ OKUMA MOTORU (Bozuk JSON çökmelerine karşı zırh)
const safeRead = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error("Hafıza okuma hatası (Veri bozuk, oturum sıfırlanıyor):", error);
        return null;
    }
};

// 2. GÜVENLİ YAZMA MOTORU (Tarayıcı gizli sekme / kota dolma koruması)
const safeWrite = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        broadcastState('user-updated', data);
    } catch (error) {
        console.error("Hafıza yazma hatası (Tarayıcı engelledi veya kota dolu):", error);
    }
};

// 3. MERKEZİ STATE (HAFIZA) NESNESİ
export const STATE = {
    // Başlangıçta güvenli okuma motoruyla veriyi çek
    user: safeRead(),

    // Kullanıcı içeride mi?
    isLoggedIn: () => {
        return STATE.user !== null && STATE.user !== undefined;
    },

    // Kullanıcı verisini güvenle teslim et
    getUser: () => {
        return STATE.user || {};
    },

    // Yeni kullanıcıyı sisteme mühürle
    setUser: (userData) => {
        STATE.user = userData; 
        safeWrite(userData);
    },

    // Tekil bir veriyi güncelle (Örn: Sadece şehri değiştir)
    updateUser: (key, value) => {
        if (!STATE.user) STATE.user = {};
        STATE.user[key] = value;
        safeWrite(STATE.user);
    },

    // Çoklu veriyi tek seferde güncelle (Performans için)
    updateUserMany: (updates) => {
        if (!STATE.user) STATE.user = {};
        STATE.user = { ...STATE.user, ...updates };
        safeWrite(STATE.user);
    },

    // VIP Viral Paylaşım Sayacını Artır
    incrementInviteCount: () => {
        if (!STATE.user) return 0;
        const currentCount = STATE.user.inviteCount || 0;
        STATE.user.inviteCount = currentCount + 1;
        safeWrite(STATE.user);
        return STATE.user.inviteCount;
    },

    // VIP Numarasını Mühürle
    setVipNumber: (num) => {
        if (!STATE.user) return;
        STATE.user.userNo = num;
        STATE.user.isVip = true;
        safeWrite(STATE.user);
    },

    // Standart Numarayı Mühürle
    setStandardNumber: (num) => {
        if (!STATE.user) return;
        STATE.user.userNo = num;
        STATE.user.isVip = false;
        safeWrite(STATE.user);
    },

    // Telefon Onaylandığında Tetiklenecek Motor
    setPhoneVerified: () => {
        if (!STATE.user) return;
        STATE.user.hasPhone = true;
        // Eğer adamın belgesi zaten onaylıysa veya kuyruktaysa statüsünü düşürme
        if(STATE.user.authStage !== 'pdf_verified' && STATE.user.authStage !== 'document_pending') {
            STATE.user.authStage = 'phone_verified';
        }
        safeWrite(STATE.user);
    },

    // Mesleki Belge Kuyruğa Girdiğinde Tetiklenecek Motor
    setDocumentPending: () => {
        if (!STATE.user) return;
        STATE.user.authStage = 'document_pending';
        STATE.user.documentPending = true;
        safeWrite(STATE.user);
    },

    // Mesleki Belge Onaylandığında (Tam Erişim) Tetiklenecek Motor
    setPdfVerified: () => {
        if (!STATE.user) return;
        STATE.user.authStage = 'pdf_verified';
        STATE.user.documentPending = false;
        STATE.user.votePower = "1.0x";
        safeWrite(STATE.user);
    },

    // Şehir (Tribün) Seçimini Mühürle
    setCity: (city) => {
        if (!STATE.user) return;
        STATE.user.city = city;
        safeWrite(STATE.user);
    },

    // Güvenli Çıkış (Sadece ME26 verisini siler)
    clearSession: () => {
        STATE.user = null;
        try {
            localStorage.removeItem(STORAGE_KEY);
            broadcastState('session-cleared');
        } catch(e) {}
    },

    // Tam Temizlik (Tarayıcıdaki tüm kalıntıları imha eder)
    clearAll: () => {
        STATE.user = null;
        try {
            localStorage.clear();
            broadcastState('session-cleared');
        } catch(e) {}
    }
};


if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        STATE.user = event.newValue ? safeRead() : null;
        window.dispatchEvent(new CustomEvent('me26:state-sync', { detail: { source: 'storage', user: STATE.user } }));
    });

    if (SESSION_CHANNEL) {
        SESSION_CHANNEL.onmessage = (event) => {
            const action = event.data?.action;
            if (action === 'user-updated') {
                STATE.user = event.data.payload || safeRead();
                window.dispatchEvent(new CustomEvent('me26:state-sync', { detail: { source: 'broadcast', user: STATE.user } }));
            }
            if (action === 'session-cleared') {
                STATE.user = null;
                window.dispatchEvent(new CustomEvent('me26:state-sync', { detail: { source: 'broadcast', user: null } }));
            }
        };
    }
}
