/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Kurşun Geçirmez Sürüm - Çökme Korumalı + VIP Destekli
   ========================================================================== */

export const STATE = {
    // Başlangıçta tarayıcının kasasından (localStorage) kullanıcının eski verilerini çek (Hatırlama yeteneği)
    user: JSON.parse(localStorage.getItem('me26_user')) || null,

    // Kullanıcı o an içeride mi (giriş yapmış mı) onu kontrol eden güvenlik şalteri
    isLoggedIn: () => {
        return STATE.user !== null && STATE.user !== undefined;
    },

    // YENİ EKLENDİ: VIP motoru kullanıcının bilgilerini istediğinde ona güvenle veriyi teslim eden komut
    getUser: () => {
        return STATE.user || {};
    },

    // Yeni biri girdiğinde tüm bilgilerini kasaya kilitleyen motor
    setUser: (userData) => {
        STATE.user = userData; 
        localStorage.setItem('me26_user', JSON.stringify(userData));
    },

    // Ufak bir bilgi değiştiğinde (Örneğin adam şehrini seçtiğinde) sadece o bilgiyi güncelleyen motor
    updateUser: (key, value) => {
        if (!STATE.user) STATE.user = {};
        STATE.user[key] = value;
        localStorage.setItem('me26_user', JSON.stringify(STATE.user));
    },

    // YENİ EKLENDİ: Kullanıcı WhatsApp'tan link paylaştığında davet sayacını 1 artıran matematik motoru
    incrementInviteCount: () => {
        if (!STATE.user) return 0; // Adam yoksa 0 döndür
        const currentCount = STATE.user.inviteCount || 0; // Eski sayıyı bul
        STATE.user.inviteCount = currentCount + 1; // 1 ekle
        localStorage.setItem('me26_user', JSON.stringify(STATE.user)); // Kasaya geri kaydet
        return STATE.user.inviteCount; // Yeni sayıyı ekrana söyle
    },

    // YENİ EKLENDİ: Kullanıcı VIP numarasını seçtiğinde o numarayı alnına (verisine) mühürleyen motor
    setVipNumber: (num) => {
        if (!STATE.user) return;
        STATE.user.userNo = num;
        STATE.user.isVip = true;
        localStorage.setItem('me26_user', JSON.stringify(STATE.user));
    },

    // GÜVENLİ ÇIKIŞ: Adam çıkış yaptığında hafızayı anında temizleyip kapıyı kilitleyen motor
    clearSession: () => {
        STATE.user = null;
        localStorage.removeItem('me26_user');
    },

    // SIFIRLAMA: Sitedeki tüm kalıntıları imha eden acil durum butonu
    clearAll: () => {
        STATE.user = null;
        localStorage.clear();
    }
};
