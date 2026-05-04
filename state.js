/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Kurşun Geçirmez Sürüm - Çökme Korumalı
   ========================================================================== */

export const STATE = {
    // Başlangıçta tarayıcının kasasından (localStorage) veriyi çek
    user: JSON.parse(localStorage.getItem('me26_user')) || null,

    // Giriş yapılıp yapılmadığını kontrol et
    isLoggedIn: () => {
        return STATE.user !== null && STATE.user !== undefined;
    },

    // YENİ GİRİŞ: Veriyi anında kaydet
    setUser: (userData) => {
        STATE.user = userData; 
        localStorage.setItem('me26_user', JSON.stringify(userData));
    },

    // GÜNCELLEME: Tekil verileri güncelle (Örn: oy gücü)
    updateUser: (key, value) => {
        if (!STATE.user) STATE.user = {};
        STATE.user[key] = value;
        localStorage.setItem('me26_user', JSON.stringify(STATE.user));
    },

    // GÜVENLİ ÇIKIŞ: Hafızayı anında temizle
    clearSession: () => {
        STATE.user = null;
        localStorage.removeItem('me26_user');
    },

    // SIFIRLAMA: Tüm site verilerini imha et
    clearAll: () => {
        STATE.user = null;
        localStorage.clear();
    }
};
