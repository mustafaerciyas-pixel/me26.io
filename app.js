/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   Sıkı Yönetici Onayı (Manual Verify) Kuralı
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';
import { DB } from './supabase.js';

export const Me26VotingSystem = {
    init: function() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e.target));
        });

        const unlockBtn = document.getElementById('btn-unlock-manifesto');
        if(unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                if (STATE.isLoggedIn()) {
                    UI.toggleProfileDrawer(true);
                } else {
                    AUTH.loginWithGoogle(); 
                }
            });
        }
    },

    updateVisibility: function() {
        const lockedState = document.getElementById('locked-state');
        const manifestoGrid = document.getElementById('manifesto-grid');

        const navReg = document.getElementById('btn-register-nav');
        const navLog = document.getElementById('btn-login-nav');
        const navProf = document.getElementById('btn-profile-nav');
        
        const mobReg = document.getElementById('btn-register-mobile');
        const mobLog = document.getElementById('btn-login-mobile');
        const mobProf = document.getElementById('btn-profile-mobile');

        const vipSection = document.getElementById('ui-vip-section');
        const citySection = document.getElementById('ui-city-selector-container');
        const phoneBtn = document.getElementById('btn-open-phone-modal');
        const pdfBtn = document.getElementById('btn-open-pdf-modal');

        if (STATE.isLoggedIn()) {
            const isCitySelected = STATE.user.city && STATE.user.city !== 'Seçilmedi' && STATE.user.city !== 'Belirsiz';
            const authStage = STATE.user.authStage || 'registered';
            const votePower = parseFloat((STATE.user.votePower || "0").replace('x', ''));
            const hasPhone = STATE.user.hasPhone === true;
            const hasAssignedId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' && String(STATE.user.userNo) !== 'null';

            // 1. ŞEHİR KUTUSUNU YÖNET
            if (citySection) {
                if (isCitySelected) {
                    citySection.classList.add('hidden'); 
                } else {
                    citySection.classList.remove('hidden'); 
                }
            }

            if (isCitySelected) {
                if(lockedState) lockedState.style.display = 'none';
                if(manifestoGrid) {
                    manifestoGrid.classList.remove('hidden');
                    manifestoGrid.classList.add('grid');
                }
            } else {
                if(lockedState) lockedState.style.display = 'flex';
                if(manifestoGrid) {
                    manifestoGrid.classList.add('hidden');
                    manifestoGrid.classList.remove('grid');
                }
            }

            // =====================================================================
            // 2. VIP KUTUSUNU YÖNET (YÖNETİCİ ONAYI OLMADAN ASLA AÇILMAZ!)
            // =====================================================================
            if (vipSection) {
                if (hasAssignedId) {
                    // Numarayı çoktan aldıysa gizle
                    vipSection.classList.add('hidden'); 
                } 
                else if (authStage !== 'pdf_verified') {
                    // YÖNETİCİ ONAYLAMADIYSA (1.0x GÜÇ ALMADIYSA) KESİNLİKLE GİZLE!
                    vipSection.classList.add('hidden');
                } 
                else {
                    // ONAYLANDIYSA (Güç 1.0 olduysa) ARTIK NUMARASINI SEÇEBİLİR
                    vipSection.classList.remove('hidden');
                }
            }

            // 3. TELEFON BUTONUNU YÖNET
            if (phoneBtn) {
                if (hasPhone) {
                    phoneBtn.classList.add('hidden'); 
                } else {
                    phoneBtn.classList.remove('hidden'); 
                }
            }

            // 4. PDF (E-DEVLET) BUTONUNU YÖNET
            if (pdfBtn) {
                if (!hasPhone) {
                    pdfBtn.classList.add('hidden');
                } else {
                    if (authStage === 'pdf_verified' || votePower >= 1.0) {
                        pdfBtn.classList.add('hidden'); 
                    } else if (authStage === 'document_pending') {
                        pdfBtn.classList.remove('hidden');
                        pdfBtn.innerHTML = '⏳ BELGE ONAY BEKLİYOR...';
                        pdfBtn.disabled = true;
                        pdfBtn.classList.add('opacity-50', 'cursor-not-allowed', 'border-yellow-500/50', 'text-yellow-400');
                        pdfBtn.classList.remove('border-green-500/50', 'text-green-400', 'hover:bg-slate-700');
                    } else {
                        pdfBtn.classList.remove('hidden');
                        pdfBtn.innerHTML = '📜 E-Devlet Yükle (1.0x Tam Yetki)';
                        pdfBtn.disabled = false;
                        pdfBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'border-yellow-500/50', 'text-yellow-400');
                        pdfBtn.classList.add('border-green-500/50', 'text-green-400', 'hover:bg-slate-700');
                    }
                }
            }
            
            const inviteLinkEl = document.getElementById('ui-invite-link');
            if(inviteLinkEl && STATE.user && STATE.user.davetKodu) {
                inviteLinkEl.textContent = `https://me26.org/katil?ref=${STATE.user.davetKodu}`;
            }

            if(navReg) navReg.classList.add('hidden');
            if(navLog) navLog.classList.add('hidden');
            if(navProf) navProf.classList.remove('hidden');

            if(mobReg) mobReg.classList.add('hidden');
            if(mobLog) mobLog.classList.add('hidden');
            if(mobProf) mobProf.classList.remove('hidden');
            
        } else {
            if(lockedState) lockedState.style.display = 'flex';
            if(manifestoGrid) {
                manifestoGrid.classList.add('hidden');
                manifestoGrid.classList.remove('grid');
            }

            if(navReg) navReg.classList.remove('hidden');
            if(navLog) navLog.classList.remove('hidden');
            if(navProf) navProf.classList.add('hidden');

            if(mobReg) mobReg.classList.remove('hidden');
            if(mobLog) mobLog.classList.remove('hidden');
            if(mobProf) mobProf.classList.add('hidden');
        }
    },

    handleVote: async function(btnEl) {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Oy kullanmak için sisteme giriş yapmalısın!', 'error');
            return;
        }

        const userRole = (STATE.user && (STATE.user.role || STATE.user.job)) ? (STATE.user.role || STATE.user.job).toLowerCase() : '';
        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); 

        if (requiredAuth === 'icmimar' && !userRole.includes('içmimar') && !userRole.includes('mimar')) {
            UI.showToast('Erişim Engellendi: Bu sandığı sadece İçmimarlar oylayabilir.', 'error');
            return;
        }
        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) {
            UI.showToast('Erişim Engellendi: Bu sandık sadece Öğrenciler içindir.', 'error');
            return;
        }

        const currentPower = parseFloat((STATE.user.votePower || "0").replace('x', ''));
        if (currentPower === 0) {
            UI.showToast('Geçersiz Oy Gücü! Profil panelinden e-devlet belgenizi onaylatmalısınız.', 'error');
            return;
        }

        const choice = btnEl.getAttribute('data-vote');
        
        const allButtons = container.querySelectorAll('.vote-btn');
        allButtons.forEach(b => {
            b.disabled = true;
            b.classList.remove('hover:border-green-500', 'hover:border-yellow-500', 'hover:border-red-500', 'hover:bg-slate-700');
            b.classList.add('opacity-30', 'cursor-not-allowed');
        });

        btnEl.classList.remove('opacity-30', 'bg-slate-800', 'text-gray-400');
        
        if (choice === 'yes') btnEl.classList.add('bg-green-900/60', 'border-green-500', 'text-green-400');
        else if (choice === 'abstain') btnEl.classList.add('bg-yellow-900/60', 'border-yellow-500', 'text-yellow-400');
        else if (choice === 'no') btnEl.classList.add('bg-red-900/60', 'border-red-500', 'text-red-400');
        
        this.animateResults(container.parentElement, choice, currentPower);
        UI.showToast(`Oyunuz test sandığına başarıyla işlendi! (Güç: ${currentPower}x)`, 'success');
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
            const barY = cardEl.querySelector('.vote-bar-yes');
            const barA = cardEl.querySelector('.vote-bar-abstain');
            const barN = cardEl.querySelector('.vote-bar-no');
            if(barY) barY.style.width = pY + '%';
            if(barA) barA.style.width = pA + '%';
            if(barN) barN.style.width = pN + '%';

            const textY = cardEl.querySelector('.vote-text-yes');
            const textA = cardEl.querySelector('.vote-text-abstain');
            const textN = cardEl.querySelector('.vote-text-no');
            if(textY) textY.textContent = `%${pY} Kabul`;
            if(textA) textA.textContent = `%${pA} Çekimser`;
            if(textN) textN.textContent = `%${pN} Ret`;
        }, 50);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        Me26VotingSystem.init();

        window.addEventListener('auth_changed', () => {
            Me26VotingSystem.updateVisibility();
        });

        const bind = (id, event, fn) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, fn);
            }
        };

        const loginButtons = [
            'btn-register-hero', 'btn-register-sticky', 'btn-register-nav', 'btn-register-mobile',
            'btn-login-hero', 'btn-login-sticky', 'btn-login-nav', 'btn-login-mobile'
        ];
        
        loginButtons.forEach(id => {
            bind(id, 'click', (e) => {
                e.preventDefault();
                AUTH.loginWithGoogle();
            });
        });

        ['btn-profile-nav', 'btn-profile-mobile'].forEach(id => {
            bind(id, 'click', (e) => {
                e.preventDefault();
                UI.toggleMobileMenu(false);
                UI.toggleProfileDrawer(true);
            });
        });

        bind('btn-open-mobile-menu', 'click', () => UI.toggleMobileMenu(true));
        bind('btn-close-mobile-menu', 'click', () => UI.toggleMobileMenu(false));
        bind('btn-close-profile-drawer', 'click', () => UI.toggleProfileDrawer(false));
        
        bind('btn-save-profile-city', 'click', async () => {
            const citySelect = document.getElementById('input-profile-city');
            const selectedCity = citySelect.value;
            
            if (!selectedCity) {
                UI.showToast('Lütfen listeden bir tribün (şehir) seçin.', 'error');
                return;
            }

            const btn = document.getElementById('btn-save-profile-city');
            const originalText = btn.innerHTML;
            btn.innerHTML = '...';
            btn.disabled = true;

            try {
                await DB.sehirGuncelle(STATE.user.uid, selectedCity); 
                STATE.updateUser('city', selectedCity); 
                UI.renderProfile(); 
                Me26VotingSystem.updateVisibility(); 
                
                UI.showToast(`Harika! ${selectedCity} tribününe katıldın.`, 'success');
            } catch (error) {
                UI.showToast('Şehir kaydedilemedi. Bağlantınızı kontrol edin.', 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        bind('btn-close-wow', 'click', () => {
            UI.closeModal('wow-modal');
            UI.showView('voting');
            UI.toggleProfileDrawer(true); 
        });

        const copyLinkToClipboard = async () => {
            const inviteLinkEl = document.getElementById('ui-invite-link');
            const link = inviteLinkEl ? inviteLinkEl.textContent : 'https://me26.org';
            try {
                await navigator.clipboard.writeText(link);
                UI.showToast('Davet linkin kopyalandı! Instagramda paylaş.', 'success');
            } catch(e) {
                UI.showToast('Link kopyalanamadı, manuel seç.', 'error');
            }
        };
        
        bind('btn-copy-invite', 'click', copyLinkToClipboard);
        bind('ui-invite-link', 'click', copyLinkToClipboard);
        bind('btn-wow-copy-link', 'click', copyLinkToClipboard);
        bind('btn-vip-copy-invite-locked', 'click', copyLinkToClipboard);

        bind('btn-share-id-card', 'click', copyLinkToClipboard); 
        bind('btn-whatsapp-share', 'click', () => {
            const link = document.getElementById('ui-invite-link')?.textContent || 'https://me26.org';
            window.open(`https://wa.me/?text=Sadece İçmimarların Girebildiği Dijital Stadyuma Katıl: ${link}`, '_blank');
        });

        bind('btn-open-vip-modal', 'click', () => UI.openModal('vip-modal'));
        bind('btn-close-vip-modal', 'click', () => UI.closeModal('vip-modal'));

        bind('btn-standart-numara', 'click', async () => {
            if (!confirm('VIP numara seçme hakkından vazgeçip, sıradaki ilk boş numarayı otomatik almak istediğine emin misin?')) return;
            
            const btn = document.getElementById('btn-standart-numara');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'NUMARAN BASILIYOR...';
            btn.disabled = true;

            try {
                const yeniNo = await DB.standartNumaraAl(STATE.user.uid);
                STATE.updateUser('userNo', yeniNo);
                STATE.updateUser('isVip', false);
                
                UI.renderProfile(); 
                Me26VotingSystem.updateVisibility(); 
                
                UI.showToast(`Harika! Numaran atandı: TR-IA-${yeniNo}`, 'success');
                
            } catch(e) {
                UI.showToast('Numara atanırken bir hata oluştu.', 'error');
            } finally {
                if(btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        });

        bind('btn-open-phone-modal', 'click', () => UI.openModal('phone-modal'));
        bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
        bind('btn-submit-phone', 'click', AUTH.verifyPhone);
        bind('btn-verify-otp', 'click', AUTH.verifyOtp);

        bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
        bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

        bind('btn-logout', 'click', AUTH.logout);
        bind('btn-delete-account', 'click', AUTH.deleteAccount);

        bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
        bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
        
        const btnSubmitPdf = document.getElementById('btn-submit-pdf');
        if (btnSubmitPdf) {
            const newBtn = btnSubmitPdf.cloneNode(true);
            btnSubmitPdf.parentNode.replaceChild(newBtn, btnSubmitPdf);
            newBtn.addEventListener('click', AUTH.verifyPdf);
        }

        const isRedirect = await AUTH.checkRedirect();
        
        if (!isRedirect) {
            if (STATE.isLoggedIn()) {
                UI.showView('voting');
            } else {
                UI.showView('landing');
            }
            UI.renderProfile();
            Me26VotingSystem.updateVisibility();
        }
    } catch (error) {
        console.error("🔥 Arayüz Motoru Başlatılamadı:", error);
    }
});
