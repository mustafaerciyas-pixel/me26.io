/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE SAAS MENÜ YÖNLENDİRİCİSİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB, supabase } from './supabase.js';
import { auth } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { googleIleGiris, sistemdenCikis } from './auth.js';

export const AUTH = {
    loginWithGoogle: async () => {
        const userData = await googleIleGiris();
        if (userData) window.location.reload(); 
    },
    logout: sistemdenCikis
};

window.loginWithGoogle = AUTH.loginWithGoogle;
window.AUTH = AUTH;

export const Me26VotingSystem = {
    init: function() {
        this.loadProposals();
    },
    loadProposals: async function() {
        try {
            const onergeler = await DB.onergeleriGetir();
            UI.renderProposals(onergeler);
        } catch (error) {
            console.error("Önergeler yüklenemedi", error);
        }
    }
};

function şantiyeyiBaslat() {
    Me26VotingSystem.init();

    const bind = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

    // Dış Kapı Butonları
    ['btn-register-hero', 'btn-register-nav', 'btn-login-hero', 'btn-login-nav'].forEach(id => { 
        const btn = document.getElementById(id); if (btn) btn.onclick = AUTH.loginWithGoogle; 
    });

    // SAAS MENÜSÜ: SEKMELER ARASI GEÇİŞ (Magic Router)
    document.querySelectorAll('.nav-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            UI.switchSaasTab(targetId);
        });
    });

    // Profil Şehir Kaydetme
    bind('btn-save-profile-city', 'click', async () => {
        const citySelect = document.getElementById('input-profile-city');
        const selectedCity = citySelect ? citySelect.value : null;
        if (!selectedCity) { UI.showToast('Tribün seçimi yapmalısınız.', 'error'); return; }
        
        try {
            await DB.sehirGuncelle(STATE.user.uid, selectedCity); 
            STATE.updateUser('city', selectedCity); 
            UI.renderProfile(); 
            UI.showToast(`Harika! ${selectedCity} tribününe katıldın.`, 'success');
            
            // Seçim sonrası Sandıkları göster
            const locked = document.getElementById('locked-state');
            const grid = document.getElementById('manifesto-grid');
            if(locked) locked.classList.add('hidden');
            if(grid) grid.classList.remove('hidden');

        } catch (error) { UI.showToast('Şehir kaydedilemedi.', 'error'); } 
    });

    // Önerge ve QA Butonları
    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

    bind('btn-logout', 'click', AUTH.logout);

    // KİMLİK KONTROLÜ VE EKRAN AÇILIŞI
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const { data: dbUser } = await supabase.from('users').select('*').eq('id', firebaseUser.uid).maybeSingle(); 
            if (dbUser) {
                STATE.user = { 
                    uid: dbUser.id, name: dbUser.isim, email: dbUser.email, photo: dbUser.foto, 
                    city: dbUser.sehir || 'Belirsiz', role: dbUser.mesleki_durum || 'Belirsiz', 
                    votePower: dbUser.oy_gucu + "x", userNo: dbUser.vip_kurucu_no || 'BEKLEYEN', 
                    davetKodu: dbUser.kendi_davet_kodu, hasPhone: dbUser.telefon ? true : false, 
                    authStage: dbUser.belge_durumu === 'Onaylandı' ? 'pdf_verified' : (dbUser.belge_durumu === 'Onay Bekliyor' ? 'document_pending' : 'registered') 
                };
                
                // KULLANICI İÇERİDEYSE YENİ SAAS PANELİNİ AÇ VE LOBİYE YÖNLENDİR
                UI.showView('saas');
                UI.switchSaasTab('view-lobi');

                // Şehir Seçilmediyse Sandıkları Kilitle
                const locked = document.getElementById('locked-state');
                const grid = document.getElementById('manifesto-grid');
                if (STATE.user.city === 'Belirsiz' || STATE.user.city === 'Seçilmedi') {
                    if(locked) { locked.classList.remove('hidden'); locked.classList.add('flex'); }
                    if(grid) grid.classList.add('hidden');
                } else {
                    if(locked) locked.classList.add('hidden');
                    if(grid) grid.classList.remove('hidden');
                }
            }
        } else { 
            STATE.user = null; 
            // KULLANICI YOKSA DIŞ KAPIYI (LANDING) GÖSTER
            UI.showView('landing'); 
        }
        UI.renderProfile();
    });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', şantiyeyiBaslat); } 
else { şantiyeyiBaslat(); }
