/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE SAAS MENÜ YÖNLENDİRİCİSİ (app.js)
   Canlı Yayın (Production) Sürümü
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB, supabase } from './supabase.js';
import { auth } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { googleIleGiris, sistemdenCikis, eDevletBelgesiOku, gercekSmsGonder, gercekSmsDogrula } from './auth.js';
import { VIP } from './vip.js'; 

// ======================================================
// 1. EVRENSEL MECLİS KALEMİ (GEMINI AI - YAKINDA)
// ======================================================
window.evrenselGeminiDuzelt = function(kutuId, butonId) {
    UI.showToast("Meclis Kalemi yakında aktif olacak. API bağlantısı güvenli backend üzerinden kurulacak.", "info");
};

// ======================================================
// 2. ORTAK KÜRSÜ MERKEZİ DAĞITIM MOTORU (ÖNERGE + SORU)
// ======================================================
window.ortakKursuGonder = async function() {
    if (!UI.triggerVerificationGate()) return;

    const user = STATE.getUser();
    if (!user || !user.uid) return UI.showToast("Güvenlik Hatası: Oturum kimliği doğrulanamadı.", "error");

    const mod = STATE.aktifKursuModu || 'onerge';
    const baslik = document.getElementById('input-kursu-title').value.trim();
    const hedefKitle = document.getElementById('input-kursu-audience').value;
    const sorumlulukOnay = document.getElementById('input-kursu-responsibility').checked;

    if (!sorumlulukOnay) return UI.showToast("Sorumluluk beyanını onaylamanız gerekmektedir.", "error");
    if (baslik.length < 15 || baslik.length > 150) return UI.showToast("Başlık 15 ile 150 karakter arasında olmalıdır.", "error");

    const btn = document.getElementById('btn-submit-kursu');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İŞLENİYOR...';
    btn.disabled = true;

    try {
        if (mod === 'onerge') {
            const sorun = document.getElementById('input-kursu-problem').value.trim();
            const cozum = document.getElementById('input-kursu-solution').value.trim();
            const sure = document.getElementById('input-kursu-duration').value;

            if (!sorun || !cozum) throw new Error("Lütfen sorun ve çözüm alanlarını eksiksiz doldurun.");

            await DB.onergeGonder(user.uid, baslik, sorun, cozum, hedefKitle, sure);
            UI.showToast('Önergeniz başarıyla meclise sunuldu!', 'success');
            Me26VotingSystem.loadProposals(); 

            UI.switchSaasTab('view-sandik');

        } else if (mod === 'soru') {
            const icerik = document.getElementById('input-kursu-content').value.trim();
            if (icerik.length < 50 || icerik.length > 3000) throw new Error("İçerik 50 ile 3000 karakter arasında olmalıdır.");

            const yeniSoru = {
                yazar_uid: user.uid,
                yazar_dijital_id: `TR-IA-${user.userNo}`, 
                hedef_kitle: hedefKitle,
                baslik: baslik,
                icerik: icerik,
                cozuldu_mu: false, 
                sikayet_sayisi: 0  
            };

            const { error } = await supabase.from('me26_sorular').insert([yeniSoru]);
            if (error) throw new Error("Soru gönderilemedi.");
            
            UI.showToast('Sorunuz ortak akla başarıyla iletildi!', 'success');
            
            if (typeof window.qaSorulariGetir === "function") window.qaSorulariGetir(); 

            UI.switchSaasTab('view-kursu');
        }

        document.getElementById('input-kursu-title').value = '';
        if(document.getElementById('input-kursu-problem')) document.getElementById('input-kursu-problem').value = '';
        if(document.getElementById('input-kursu-solution')) document.getElementById('input-kursu-solution').value = '';
        if(document.getElementById('input-kursu-content')) document.getElementById('input-kursu-content').value = '';
        document.getElementById('input-kursu-responsibility').checked = false;
        UI.closeModal('ortak-kursu-modal');

    } catch (error) {
        UI.showToast(error.message || "Gönderim sırasında bir hata oluştu.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ======================================================
// 3. KİMLİK DOĞRULAMA (AUTH) KÖPRÜSÜ
// ======================================================
export const AUTH = {
    loginWithGoogle: async () => {
        const userData = await googleIleGiris();
        if (userData) window.location.reload(); 
    },
    logout: sistemdenCikis,
    
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
            UI.showToast(error.message || 'Hata! Lütfen tekrar deneyin.', 'error');
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
            await gercekSmsDogrula(otpValue, STATE.getUser().uid, phoneValue);
            UI.showToast('Telefon başarıyla onaylandı!', 'success');
            UI.closeModal('phone-modal');
            UI.renderProfile();
        } catch (error) {
            UI.showToast(error.message || 'Hatalı kod girdiniz!', 'error');
            if(btn) { btn.innerHTML = 'KODU ONAYLA'; btn.disabled = false; }
        }
    },

    verifyPdf: async () => {
        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput || !fileInput.files[0]) { UI.showToast('Önce bir belge seçin.', 'error'); return; }
        
        const btn = document.getElementById('btn-submit-pdf');
        const isTerfi = STATE.getUser() && STATE.getUser().authStage === 'pdf_verified';

        if(btn) { btn.innerHTML = isTerfi ? 'UNVAN GÜNCELLENİYOR...' : 'İNCELEMEYE GÖNDERİLİYOR...'; btn.disabled = true; }
        
        try {
            await eDevletBelgesiOku(fileInput.files[0], STATE.getUser()?.uid);
            
            if (isTerfi) {
                UI.showToast('Belgeniz incelemeye alındı. Onay sonrası unvanınız güncellenecektir.', 'success');
            } else {
                UI.showToast('Belge başvurunuz inceleme kuyruğuna alındı.', 'success');
            }
            
            UI.closeModal('pdf-modal');
            setTimeout(() => window.location.reload(), 1500); 
        } catch (error) { 
            UI.showToast(error.message || 'Bir hata oluştu.', 'error'); 
        } finally { 
            if(btn) { btn.innerHTML = isTerfi ? 'UNVANI GÜNCELLE' : 'MESLEKİ BELGEYİ GÖNDER'; btn.disabled = false; } 
        }
    }
};

// ======================================================
// 4. OTONOM SANDIK (OYLAMA) MOTORU
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

        const user = STATE.getUser();
        // --- GÜVENLİK DUVARI: OY KULLANMA ---
        if (!user.hasPhone) { UI.showToast('Oy kullanmadan önce Profil sekmesinden Telefonunuzu onaylatmalısınız (Bot Koruması).', 'error'); return; }
        if (user.authStage !== 'pdf_verified') { UI.showToast('Oy kullanabilmek için mesleki belgenizi yükleyip tam erişim almalısınız.', 'error'); return; }
        
        const userRole = user.role ? user.role.toLowerCase() : '';
        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); 
        
        if (requiredAuth === 'icmimar' && !userRole.includes('içmimar') && !userRole.includes('mimar')) { UI.showToast('Bu sandığı sadece İçmimarlık Mezunları oylayabilir.', 'error'); return; }
        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) { UI.showToast('Bu sandık sadece İçmimarlık Öğrencileri içindir.', 'error'); return; }
        
        const currentPower = parseFloat((user.votePower || "0").replace('x', ''));
        if (currentPower === 0) { UI.showToast('Profil panelinden mesleki belgenizi yükleyip tam erişim almalısınız.', 'error'); return; }
        
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
// 5. BAŞLATMA VE DİNLEYİCİLER (ŞALTERLERİ AÇMA)
// ======================================================
function şantiyeyiBaslat() {
    Me26VotingSystem.init();

    // ---------------------------------------------------------
    // TRİBÜN LİGİ CANLI VERİ ENTEGRASYONU 
    // ---------------------------------------------------------
    window.loadTribunLigiData = async () => {
        try {
            const realCityData = await DB.tribunLigiGetir();
            if (typeof UI.renderTribunLigi === "function") { 
                UI.renderTribunLigi(realCityData); 
            }
        } catch (error) {
            console.error("Tribün Ligi canlı verileri çekilemedi:", error);
        }
    };
    
    window.loadTribunLigiData();

    // Kolaylaştırıcı Fonksiyon
    const bind = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

    // --- DIŞ KAPI BUTONLARI ---
    ['btn-register-hero', 'btn-register-nav', 'btn-login-hero', 'btn-login-nav'].forEach(id => { 
        bind(id, 'click', AUTH.loginWithGoogle); 
    });

    // --- SAAS İÇ MENÜ GEÇİŞLERİ ---
    document.querySelectorAll('.nav-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            UI.switchSaasTab(targetId);
            if(window.innerWidth < 768) {
                document.querySelectorAll('.nav-menu-btn i').forEach(icon => icon.classList.remove('text-kaos'));
                e.currentTarget.querySelector('i').classList.add('text-kaos');
            }
        });
    });

    // --- PROFİL VE GÖREV BUTONLARI ---
    bind('btn-save-profile-city', 'click', async () => {
        const citySelect = document.getElementById('input-profile-city');
        const selectedCity = citySelect ? citySelect.value : null;
        if (!selectedCity) { UI.showToast('Tribün seçimi yapmalısınız.', 'error'); return; }
        
        try {
            await DB.sehirGuncelle(STATE.getUser().uid, selectedCity); 
            STATE.setCity(selectedCity); 
            UI.renderProfile(); 
            UI.showToast(`Harika! ${selectedCity} tribününe katıldın.`, 'success');
            
            if (typeof window.loadTribunLigiData === "function") window.loadTribunLigiData();
            
            const locked = document.getElementById('locked-state');
            const grid = document.getElementById('manifesto-grid');
            if(locked) locked.classList.add('hidden');
            if(grid) grid.classList.remove('hidden');
        } catch (error) { UI.showToast('Şehir kaydedilemedi.', 'error'); } 
    });

    bind('btn-standart-numara', 'click', async () => {
        if (!confirm('Sıradaki boş numarayı otomatik almak istediğine emin misin?')) return;
        try {
            const yeniNo = await DB.standartNumaraAl(STATE.getUser().uid);
            STATE.setStandardNumber(yeniNo);
            UI.renderProfile(); UI.showToast(`Numaran atandı: TR-IA-${yeniNo}`, 'success');
        } catch(e) { UI.showToast('Numara alınamadı.', 'error'); } 
    });

    // --- MODALLAR VE KÜRSÜ ---
    bind('btn-open-proposal-modal', 'click', () => { UI.openKursuModal(); UI.switchKursuTab('onerge'); });
    bind('btn-open-qa-modal', 'click', () => { UI.openKursuModal(); UI.switchKursuTab('soru'); });
    bind('btn-close-kursu-modal', 'click', () => UI.closeModal('ortak-kursu-modal'));
    bind('tab-btn-onerge', 'click', () => UI.switchKursuTab('onerge'));
    bind('tab-btn-soru', 'click', () => UI.switchKursuTab('soru'));
    bind('btn-submit-kursu', 'click', window.ortakKursuGonder);
    
    // Profil Modalları
    bind('btn-open-phone-modal', 'click', () => { AUTH.resetPhoneModal(); UI.openModal('phone-modal'); });
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-logout', 'click', AUTH.logout);

    const btnSubmitPdf = document.getElementById('btn-submit-pdf');
    if (btnSubmitPdf) {
        const newBtn = btnSubmitPdf.cloneNode(true);
        btnSubmitPdf.parentNode.replaceChild(newBtn, btnSubmitPdf);
        newBtn.addEventListener('click', AUTH.verifyPdf);
    }

    // --- VIP VE PAYLAŞIM ---
    bind('btn-open-vip-modal', 'click', () => { UI.openModal('vip-modal'); VIP.updateModalState(); });
    bind('btn-close-vip-modal', 'click', () => UI.closeModal('vip-modal'));
    bind('btn-claim-vip-number', 'click', VIP.claimNumber);
    bind('btn-whatsapp-share', 'click', () => VIP.handleShare(true));
    bind('btn-copy-invite', 'click', () => VIP.handleShare(false));

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
            
            const user = STATE.getUser();
            if (!user.hasPhone || user.authStage !== 'pdf_verified') {
                UI.showToast('Önergeyi destekleyebilmek için Profil sekmesinden Telefon ve Mesleki Belge onaylarınızı tamamlamalısınız.', 'error');
                return;
            }

            const onergeId = destekBtn.getAttribute('data-id');
            const originalText = destekBtn.innerHTML;
            destekBtn.innerHTML = '...'; destekBtn.disabled = true;

            DB.destekVer(user.uid, onergeId).then(() => {
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

    // ======================================================
    // YETKİ KONTROL VE ANA YÖNLENDİRME (ROUTER)
    // ======================================================
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const { data: dbUser } = await supabase.from('users').select('*').eq('id', firebaseUser.uid).maybeSingle(); 
            if (dbUser) {
                STATE.setUser({ 
                    uid: dbUser.id, name: dbUser.isim, email: dbUser.email, photo: dbUser.foto, 
                    city: dbUser.sehir || 'Belirsiz', role: dbUser.mesleki_durum || 'Belirsiz', 
                    votePower: dbUser.oy_gucu + "x", userNo: dbUser.vip_kurucu_no || 'BEKLEYEN', 
                    davetKodu: dbUser.kendi_davet_kodu, hasPhone: dbUser.telefon ? true : false, 
                    authStage: dbUser.belge_durumu === 'Onaylandı' ? 'pdf_verified' : (dbUser.belge_durumu === 'Onay Bekliyor' ? 'document_pending' : 'registered'),
                    inviteCount: dbUser.davet_edilen_kisi_sayisi || 0,
                    isVip: dbUser.is_vip || false
                });
                
                UI.showView('saas');
                UI.switchSaasTab('view-lobi');

                const locked = document.getElementById('locked-state');
                const grid = document.getElementById('manifesto-grid');
                if (STATE.getUser().city === 'Belirsiz' || STATE.getUser().city === 'Seçilmedi') {
                    if(locked) { locked.classList.remove('hidden'); locked.classList.add('flex'); }
                    if(grid) grid.classList.add('hidden');
                } else {
                    if(locked) locked.classList.add('hidden');
                    if(grid) grid.classList.remove('hidden');
                }
            }
        } else { 
            STATE.clearSession();
            UI.showView('landing'); 
        }
        
        UI.renderProfile();
        if (typeof window.loadTribunLigiData === "function") window.loadTribunLigiData();
    });
}

// Şantiyeyi Çalıştır
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', şantiyeyiBaslat); } 
else { şantiyeyiBaslat(); }
