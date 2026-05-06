/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE SAAS MENÜ YÖNLENDİRİCİSİ (app.js)
   SaaS Mimarisi + Öğrenci Terfi Motoru + Otonom Sandık
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB, supabase } from './supabase.js';
import { auth } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { googleIleGiris, sistemdenCikis, eDevletBelgesiOku, gercekSmsGonder, gercekSmsDogrula } from './auth.js';

export const AUTH = {
    loginWithGoogle: async () => {
        const userData = await googleIleGiris();
        if (userData) window.location.reload(); 
    },
    logout: sistemdenCikis,
    
    // ======================================================
    // SMS VE PDF ONAY MOTORLARI
    // ======================================================
    resetPhoneModal: () => {
        const step1 = document.getElementById('phone-step-1');
        const step2 = document.getElementById('phone-step-2');
        const phoneInput = document.getElementById('input-phone-number');
        const otpInput = document.getElementById('input-otp-code');
        const btnPhone = document.getElementById('btn-submit-phone');
        const btnOtp = document.getElementById('btn-verify-otp');

        if (step1) { step1.style.display = 'block'; step1.classList.remove('hidden'); }
        if (step2) { step2.style.display = 'none'; step2.classList.add('hidden'); }
        if (phoneInput) phoneInput.value = '';
        if (otpInput) otpInput.value = '';
        if (btnPhone) { btnPhone.innerHTML = 'SMS GÖNDER'; btnPhone.disabled = false; }
        if (btnOtp) { btnOtp.innerHTML = 'KODU ONAYLA'; btnOtp.disabled = false; }
    },

    verifyPhone: async () => {
        const phoneInput = document.getElementById('input-phone-number');
        const phoneValue = phoneInput ? phoneInput.value : '';
        if(!phoneValue || phoneValue.length < 10) { UI.showToast('Geçerli numara girin.', 'error'); return; }

        const btn = document.getElementById('btn-submit-phone');
        if(btn) { btn.innerHTML = 'BAĞLANIYOR...'; btn.disabled = true; }

        try {
            await gercekSmsGonder(phoneValue);
            UI.showToast('Kod gönderildi! Lütfen ekrana girin.', 'success');
            const step1 = document.getElementById('phone-step-1');
            const step2 = document.getElementById('phone-step-2');
            if (step1) { step1.style.display = 'none'; step1.classList.add('hidden'); }
            if (step2) { step2.style.display = 'block'; step2.classList.remove('hidden'); }
        } catch (error) {
            UI.showToast('Hata! Lütfen tekrar deneyin.', 'error');
            if(btn) { btn.innerHTML = 'SMS GÖNDER'; btn.disabled = false; }
        } 
    },

    verifyOtp: async () => {
        const otpInput = document.getElementById('input-otp-code');
        const rawValue = otpInput ? otpInput.value : '';
        const otpValue = rawValue.replace(/\s+/g, ''); 

        if(!otpValue || otpValue.length < 6) { UI.showToast('6 haneli kodu eksiksiz girin.', 'error'); return; }

        const btn = document.getElementById('btn-verify-otp');
        if(btn) { btn.innerHTML = 'DOĞRULANIYOR...'; btn.disabled = true; }

        try {
            const phoneInput = document.getElementById('input-phone-number');
            const phoneValue = phoneInput ? phoneInput.value : '';
            await gercekSmsDogrula(otpValue, STATE.user.uid, phoneValue);
            UI.showToast('Telefon başarıyla onaylandı!', 'success');
            STATE.updateUser('hasPhone', true);
            UI.closeModal('phone-modal');
            UI.renderProfile();
        } catch (error) {
            UI.showToast('Hatalı kod girdiniz!', 'error');
            if(btn) { btn.innerHTML = 'KODU ONAYLA'; btn.disabled = false; }
        }
    },

    verifyPdf: async () => {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput || !fileInput.files[0]) { UI.showToast('Önce PDF seçin.', 'error'); return; }
        
        const btn = document.getElementById('btn-submit-pdf');
        // AKILLI KONTROL: Kullanıcı zaten onaylıysa (Öğrenci terfisi yapıyorsa)
        const isTerfi = STATE.user && STATE.user.authStage === 'pdf_verified';

        if(btn) { btn.innerHTML = isTerfi ? 'UNVAN GÜNCELLENİYOR...' : 'DEŞİFRE EDİLİYOR...'; btn.disabled = true; }
        
        try {
            await eDevletBelgesiOku(fileInput.files[0], STATE.user?.uid);
            
            if (isTerfi) {
                UI.showToast('Mezuniyet belgen onaylandı! İçmimar unvanına terfi ettiriliyorsun.', 'success');
            } else {
                UI.showToast('Belge okundu! Yönetim kurulundan onay bekleniyor.', 'success');
            }
            
            UI.closeModal('pdf-modal');
            setTimeout(() => window.location.reload(), 1500); 
        } catch (error) { 
            UI.showToast(error, 'error'); 
        } finally { 
            if(btn) { btn.innerHTML = isTerfi ? 'UNVANI GÜNCELLE' : 'E-DEVLET YÜKLE'; btn.disabled = false; } 
        }
    }
};

window.loginWithGoogle = AUTH.loginWithGoogle;
window.AUTH = AUTH;

// ======================================================
// OYLAMA VE ÖNERGE SİSTEMİ
// ======================================================
export const Me26VotingSystem = {
    init: function() { this.loadProposals(); },
    
    loadProposals: async function() {
        try {
            const onergeler = await DB.onergeleriGetir();
            UI.renderProposals(onergeler);
        } catch (error) { console.error("Önergeler yüklenemedi", error); }
    },

    handleVote: async function(btnEl) {
        if (!STATE.isLoggedIn()) { UI.showToast('Oy kullanmak için giriş yapmalısın!', 'error'); return; }
        const userRole = (STATE.user && STATE.user.role) ? STATE.user.role.toLowerCase() : '';
        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); 
        
        if (requiredAuth === 'icmimar' && !userRole.includes('içmimar') && !userRole.includes('mimar')) { UI.showToast('Bu sandığı sadece İçmimarlar oylayabilir.', 'error'); return; }
        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) { UI.showToast('Bu sandık sadece Öğrenciler içindir.', 'error'); return; }
        
        const currentPower = parseFloat((STATE.user.votePower || "0").replace('x', ''));
        if (currentPower === 0) { UI.showToast('Profil panelinden e-devlet belgenizi yükleyip yetki almalısınız.', 'error'); return; }
        
        const choice = btnEl.getAttribute('data-vote');
        const allButtons = container.querySelectorAll('.vote-btn');
        allButtons.forEach(b => { b.disabled = true; b.classList.remove('hover:border-green-500', 'hover:border-yellow-500', 'hover:border-red-500', 'hover:bg-slate-700'); b.classList.add('opacity-30', 'cursor-not-allowed'); });
        
        btnEl.classList.remove('opacity-30', 'bg-slate-800', 'text-gray-400');
        if (choice === 'yes') btnEl.classList.add('bg-green-900/60', 'border-green-500', 'text-green-400');
        else if (choice === 'abstain') btnEl.classList.add('bg-yellow-900/60', 'border-yellow-500', 'text-yellow-400');
        else if (choice === 'no') btnEl.classList.add('bg-red-900/60', 'border-red-500', 'text-red-400');
        
        this.animateResults(container.parentElement, choice, currentPower);
        UI.showToast(`Oyunuz Otonom Sandığa kaydedildi. (Güç: ${currentPower}x)`, 'success');
    },

    animateResults: function(cardEl, userChoice, votePower) {
        let baseYes = Math.floor(Math.random() * 40) + 20; 
        let baseAbstain = Math.floor(Math.random() * 10) + 5;
        let baseNo = 100 - (baseYes + baseAbstain);
        if (userChoice === 'yes') baseYes += (20 * votePower);
        if (userChoice === 'abstain') baseAbstain += (20 * votePower);
        if (userChoice === 'no') baseNo += (20 * votePower);
        const total = baseYes + baseAbstain + baseNo;
        const pY = Math.round((baseYes / total) * 100);
        const pA = Math.round((baseAbstain / total) * 100);
        const pN = 100 - (pY + pA);
        setTimeout(() => {
            const barY = cardEl.querySelector('.vote-bar-yes'); const barA = cardEl.querySelector('.vote-bar-abstain'); const barN = cardEl.querySelector('.vote-bar-no');
            if(barY) barY.style.width = pY + '%'; if(barA) barA.style.width = pA + '%'; if(barN) barN.style.width = pN + '%';
            const textY = cardEl.querySelector('.vote-text-yes'); const textA = cardEl.querySelector('.vote-text-abstain'); const textN = cardEl.querySelector('.vote-text-no');
            if(textY) textY.textContent = `%${pY} Kabul`; if(textA) textA.textContent = `%${pA} Çekimser`; if(textN) textN.textContent = `%${pN} Ret`;
        }, 50);
    }
};

// ======================================================
// BAŞLATMA VE DİNLEYİCİLER (ŞALTERLER)
// ======================================================
function şantiyeyiBaslat() {
    Me26VotingSystem.init();

    const bind = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

    // Giriş Butonları
    ['btn-register-hero', 'btn-register-nav', 'btn-login-hero', 'btn-login-nav'].forEach(id => { 
        const btn = document.getElementById(id); if (btn) btn.onclick = AUTH.loginWithGoogle; 
    });

    // SAAS MENÜSÜ GEÇİŞLERİ
    document.querySelectorAll('.nav-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            UI.switchSaasTab(targetId);
            
            // Eğer mobildeysek ve menüye tıklandıysa, görsel aktifleştirmeyi yap
            if(window.innerWidth < 768) {
                document.querySelectorAll('.nav-menu-btn i').forEach(icon => icon.classList.remove('text-kaos'));
                e.currentTarget.querySelector('i').classList.add('text-kaos');
            }
        });
    });

    // Profil Görevleri (Şehir, VIP, Kopya)
    bind('btn-save-profile-city', 'click', async () => {
        const citySelect = document.getElementById('input-profile-city');
        const selectedCity = citySelect ? citySelect.value : null;
        if (!selectedCity) { UI.showToast('Tribün seçimi yapmalısınız.', 'error'); return; }
        
        try {
            await DB.sehirGuncelle(STATE.user.uid, selectedCity); 
            STATE.updateUser('city', selectedCity); 
            UI.renderProfile(); 
            UI.showToast(`Harika! ${selectedCity} tribününe katıldın.`, 'success');
            
            const locked = document.getElementById('locked-state');
            const grid = document.getElementById('manifesto-grid');
            if(locked) locked.classList.add('hidden');
            if(grid) grid.classList.remove('hidden');
        } catch (error) { UI.showToast('Şehir kaydedilemedi.', 'error'); } 
    });

    const copyLinkToClipboard = async () => {
        const link = document.getElementById('ui-invite-link')?.textContent || 'https://me26.org';
        try { await navigator.clipboard.writeText(link); UI.showToast('Davet linkin kopyalandı!', 'success'); } 
        catch(e) { UI.showToast('Link kopyalanamadı.', 'error'); }
    };
    bind('btn-copy-invite', 'click', copyLinkToClipboard);
    bind('ui-invite-link', 'click', copyLinkToClipboard);
    bind('btn-whatsapp-share', 'click', () => { window.open(`https://wa.me/?text=Sadece İçmimarların Girebildiği Dijital Stadyuma Katıl: ${document.getElementById('ui-invite-link')?.textContent || 'https://me26.org'}`, '_blank'); });

    // Standart Numara Alma
    bind('btn-standart-numara', 'click', async () => {
        if (!confirm('Sıradaki boş numarayı otomatik almak istediğine emin misin?')) return;
        try {
            const yeniNo = await DB.standartNumaraAl(STATE.user.uid);
            STATE.updateUser('userNo', yeniNo); STATE.updateUser('isVip', false);
            UI.renderProfile(); UI.showToast(`Numaran atandı: TR-IA-${yeniNo}`, 'success');
        } catch(e) { UI.showToast('Numara alınamadı.', 'error'); } 
    });

    // Modallar
    bind('btn-open-phone-modal', 'click', () => { AUTH.resetPhoneModal(); UI.openModal('phone-modal'); });
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));
    bind('btn-logout', 'click', AUTH.logout);

    const btnSubmitPdf = document.getElementById('btn-submit-pdf');
    if (btnSubmitPdf) {
        const newBtn = btnSubmitPdf.cloneNode(true);
        btnSubmitPdf.parentNode.replaceChild(newBtn, btnSubmitPdf);
        newBtn.addEventListener('click', AUTH.verifyPdf);
    }

    // ======================================================
    // DİNAMİK BUTON DİNLEYİCİLERİ (Destekle, Oyla, SMS)
    // ======================================================
    document.body.addEventListener('click', (e) => {
        const text = (e.target.textContent || '').trim();
        const id = e.target.id;
        
        if (id === 'btn-submit-phone' || text === 'SMS GÖNDER') { e.preventDefault(); AUTH.verifyPhone(); }
        else if (id === 'btn-verify-otp' || text === 'KODU ONAYLA') { e.preventDefault(); AUTH.verifyOtp(); }
        else if (e.target.classList.contains('vote-btn')) { e.preventDefault(); Me26VotingSystem.handleVote(e.target); }

        const destekBtn = e.target.closest('.btn-destekle');
        if (destekBtn) {
            e.preventDefault();
            if (!STATE.isLoggedIn()) { UI.showToast('Destek vermek için giriş yapmalısınız.', 'error'); return; }
            const onergeId = destekBtn.getAttribute('data-id');
            const originalText = destekBtn.innerHTML;
            destekBtn.innerHTML = '...'; destekBtn.disabled = true;

            DB.destekVer(STATE.user.uid, onergeId).then(() => {
                UI.showToast('Önergeye destek verdiniz!', 'success');
                Me26VotingSystem.loadProposals(); 
            }).catch(err => {
                if (err.message === 'already_supported') {
                    UI.showToast('Bu önergeyi zaten desteklediniz.', 'info');
                    destekBtn.innerHTML = 'DESTEKLENDİ';
                    destekBtn.classList.remove('bg-slate-800', 'border-slate-500', 'hover:bg-slate-700');
                    destekBtn.classList.add('bg-green-900/50', 'text-green-400', 'border-green-500');
                } else {
                    UI.showToast('Bir hata oluştu.', 'error');
                    destekBtn.innerHTML = originalText; destekBtn.disabled = false;
                }
            });
        }
    });

    // Önerge Gönderme
    bind('btn-submit-proposal', 'click', async () => {
        if (!STATE.isLoggedIn()) { UI.showToast('Önerge vermek için giriş yapmalısınız.', 'error'); return; }
        const baslik = document.getElementById('input-proposal-title').value.trim();
        const sorun = document.getElementById('input-proposal-problem').value.trim();
        const cozum = document.getElementById('input-proposal-solution').value.trim();
        const hedefKitle = document.getElementById('input-proposal-audience').value;
        const sure = document.getElementById('input-proposal-duration').value;

        if (!baslik || !sorun || !cozum) { UI.showToast('Lütfen alanları eksiksiz doldurun.', 'error'); return; }

        const btn = document.getElementById('btn-submit-proposal');
        const originalText = btn.innerHTML; btn.innerHTML = 'İŞLENİYOR...'; btn.disabled = true;

        try {
            await DB.onergeGonder(STATE.user.uid, baslik, sorun, cozum, hedefKitle, sure);
            UI.showToast('Önergeniz meclise sunuldu!', 'success');
            document.getElementById('input-proposal-title').value = ''; document.getElementById('input-proposal-problem').value = ''; document.getElementById('input-proposal-solution').value = '';
            UI.closeModal('onerge-modal');
            Me26VotingSystem.loadProposals();
        } catch (error) { UI.showToast('Önerge gönderilemedi.', 'error'); } 
        finally { btn.innerHTML = originalText; btn.disabled = false; }
    });

    // YETKİ KONTROL VE ANA YÖNLENDİRME (ROUTER)
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const { data: dbUser } = await supabase.from('users').select('*').eq('id', firebaseUser.uid).maybeSingle(); 
            if (dbUser) {
                // VERİTABANI BAĞLANTILARI BURADA TAMAMLANDI (inviteCount ve isVip Eklendi)
                STATE.user = { 
                    uid: dbUser.id, name: dbUser.isim, email: dbUser.email, photo: dbUser.foto, 
                    city: dbUser.sehir || 'Belirsiz', role: dbUser.mesleki_durum || 'Belirsiz', 
                    votePower: dbUser.oy_gucu + "x", userNo: dbUser.vip_kurucu_no || 'BEKLEYEN', 
                    davetKodu: dbUser.kendi_davet_kodu, hasPhone: dbUser.telefon ? true : false, 
                    authStage: dbUser.belge_durumu === 'Onaylandı' ? 'pdf_verified' : (dbUser.belge_durumu === 'Onay Bekliyor' ? 'document_pending' : 'registered'),
                    inviteCount: dbUser.davet_edilen_kisi_sayisi || 0,
                    isVip: dbUser.is_vip || false
                };
                
                UI.showView('saas');
                UI.switchSaasTab('view-lobi');

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
            UI.showView('landing'); 
        }
        UI.renderProfile();
    });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', şantiyeyiBaslat); } 
else { şantiyeyiBaslat(); }
