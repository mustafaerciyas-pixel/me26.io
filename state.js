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
    proposals: "me26_proposals"
};

const SESSION_KEYS = [
    STORAGE_KEYS.authStage,
    STORAGE_KEYS.userNo,
    STORAGE_KEYS.role,
    STORAGE_KEYS.city,
    STORAGE_KEYS.inviteCount,
    STORAGE_KEYS.isVip,
    STORAGE_KEYS.vipNumber,
    STORAGE_KEYS.votePower
];

const safeParseJson = (value, fallback) => {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

export const STATE = {
    getUser: () => ({
        authStage: localStorage.getItem(STORAGE_KEYS.authStage) || null,
        userNo: localStorage.getItem(STORAGE_KEYS.userNo) || "BEKLEYEN",
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
        if (!STORAGE_KEYS[key] || value === undefined || value === null) return;
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

    clearSession: () => {
        SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    },

    clearAll: () => {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    },

    getProposals: () => {
        const raw = localStorage.getItem(STORAGE_KEYS.proposals);
        const proposals = safeParseJson(raw || "[]", []);

        if (!Array.isArray(proposals)) return [];

        return proposals.filter((proposal) => {
            return proposal &&
                typeof proposal.title === "string" &&
                typeof proposal.desc === "string" &&
                typeof proposal.category === "string";
        });
    },

    addProposal: (proposal = {}) => {
        const title = String(proposal.title || "").trim();
        const desc = String(proposal.desc || "").trim();
        const category = String(proposal.category || "").trim();

        if (!title || !desc || !category) return false;

        const proposals = STATE.getProposals();

        proposals.unshift({
            id: Date.now(),
            title,
            desc,
            category,
            support: 1,
            createdAt: new Date().toISOString()
        });

        localStorage.setItem(STORAGE_KEYS.proposals, JSON.stringify(proposals));
        return true;
    }
};