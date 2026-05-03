/* ==========================================================================
   ME26 AĞI - HAFIZA VE DURUM YÖNETİMİ (js/state.js)
   ========================================================================== */

const STORAGE_KEYS = {
    authStage: "me26_auth_stage",
    userNo: "me26_uye_no",
    role: "me26_rutbe",
    city: "me26_sehir",
    inviteCount: "me26_davet_sayisi",
    isVip: "me26_is_vip",
    vipNumber: "me26_vip_number",
    votePower: "me26_vote_power",
    proposals: "me26_proposals" // YENİ: Önergeler için hafıza anahtarı
};

export const STATE = {
    // ... (getUser, setUser, incrementInviteCount vb. önceki fonksiyonların hepsi AYNI KALACAK) ...
    getUser: () => ({
        authStage: localStorage.getItem(STORAGE_KEYS.authStage) || null,
        userNo: localStorage.getItem(STORAGE_KEYS.userNo) || "???",
        role: localStorage.getItem(STORAGE_KEYS.role) || "Sistem Üyesi",
        city: localStorage.getItem(STORAGE_KEYS.city) || "Bilinmiyor",
        inviteCount: parseInt(localStorage.getItem(STORAGE_KEYS.inviteCount) || "0", 10),
        isVip: localStorage.getItem(STORAGE_KEYS.isVip) === "true",
        vipNumber: localStorage.getItem(STORAGE_KEYS.vipNumber) || null,
        votePower: localStorage.getItem(STORAGE_KEYS.votePower) || "0.0x"
    }),

    setUser: (data = {}) => {
        Object.entries(data).forEach(([key, value]) => {
            if (STORAGE_KEYS[key] && value !== undefined && value !== null) {
                localStorage.setItem(STORAGE_KEYS[key], String(value));
            }
        });
    },

    updateUser: (key, value) => {
        if (!STORAGE_KEYS[key]) return;
        localStorage.setItem(STORAGE_KEYS[key], String(value));
    },

    incrementInviteCount: () => {
        const current = parseInt(localStorage.getItem(STORAGE_KEYS.inviteCount) || "0", 10);
        const next = current + 1;
        localStorage.setItem(STORAGE_KEYS.inviteCount, String(next));
        return next;
    },

    setVipNumber: (number) => {
        localStorage.setItem(STORAGE_KEYS.vipNumber, String(number));
        localStorage.setItem(STORAGE_KEYS.userNo, String(number));
        localStorage.setItem(STORAGE_KEYS.isVip, "true");
    },

    isLoggedIn: () => {
        return !!localStorage.getItem(STORAGE_KEYS.authStage);
    },

    isPhoneVerified: () => {
        const stage = localStorage.getItem(STORAGE_KEYS.authStage);
        return stage === "phone_verified" || stage === "fully_verified";
    },

    isFullyVerified: () => {
        return localStorage.getItem(STORAGE_KEYS.authStage) === "fully_verified";
    },

    clearUser: () => {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    },

    // --- YENİ EKLENEN ÖNERGE (PROPOSAL) HAFIZASI ---
    getProposals: () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.proposals) || "[]");
        } catch {
            return [];
        }
    },

    addProposal: (proposal) => {
        const props = STATE.getProposals();
        props.unshift(proposal); // En başa ekle
        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(props));
    }
};
