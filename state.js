/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Kurşun Geçirmez Sürüm - Çökme Korumalı
   ========================================================================== */

export const STATE = {
    // 1. Başlangıçta tarayıcının kasasından (localStorage) veriyi çek
    user: JSON.parse(localStorage.getItem('me26_user')) || null,

    // 2. Giriş yapılıp yapılmadığını canlı hafızadan kontrol et
    isLoggedIn: () => {
        return STATE.user !== null && STATE.user !== undefined;
    },

    // 3. YENİ GİRİŞ: Veriyi hem canlı hafızaya (STATE) hem kasaya anında kaydet
    setUser: (userData) => {
        STATE.user = userData; // ÇÖKMEYİ ENGELLEYEN KRİTİK SATIR!
        localStorage.setItem('me26_user', JSON.stringify(userData));
    },

    // 4. GÜNCELLEME: Oy gücü veya rol gibi tekil verileri güncelle
    updateUser: (key, value) => {
        if (!STATE.user) STATE.user = {};
        STATE.user[key] = value;
        localStorage.setItem('me26_user', JSON.stringify(STATE.user));
    },

    // 5. GÜVENLİ ÇIKIŞ: Hafızayı anında temizle
    clearSession: () => {
        STATE.user = null;
        localStorage.removeItem('me26_user');
    },

    // 6. SIFIRLAMA: Tüm site verilerini imha et
    clearAll: () => {
        STATE.user = null;
        localStorage.clear();
    }
};
