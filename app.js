/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE SAAS MENÜ YÖNLENDİRİCİSİ (app.js)
   Geçici Vercel Canlı Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Google giriş / çıkış akışını başlatmak
   - Telefon ve belge modal işlemlerini yönetmek
   - SaaS menü geçişlerini bağlamak
   - Sandık / önerge / oy / destek sistemini başlatmak
   - Koruma Hattı ve Stadyum motorlarını güvenli başlatmak
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB, supabase } from './supabase.js';
import { auth } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
    googleIleGiris,
    sistemdenCikis,
    eDevletBelgesiOku,
    gercekSmsGonder,
    gercekSmsDogrula
} from './auth.js';

import { VIP } from './vip.js';
import { STADYUM } from './stadium.js';
import { KORUMA } from './koruma.js';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const bind = (id, event, fn) => {
    const el = $(id);

    if (!el) return;

    el.addEventListener(event, fn);
};

const safeTrimValue = (id) => {
    const el = $(id);

    return el && typeof el.value === 'string'
        ? el.value.trim()
        : '';
};

const safeValue = (id, fallback = '') => {
    const el = $(id);

    return el && typeof el.value !== 'undefined'
        ? el.value
        : fallback;
};

const setButtonLoading = (button, loadingText) => {
    if (!button) return '';

    const oldText = button.innerHTML;

    button.innerHTML = loadingText;
    button.disabled = true;

    return oldText;
};

const restoreButton = (button, oldText) => {
    if (!button) return;

    button.innerHTML = oldText;
    button.disabled = false;
};

const getCurrentUser = () => {
    if (typeof STATE.getUser === 'function') return STATE.getUser();

    return STATE.user || {};
};

const getVotePowerNumber = (user) => {
    const raw = user?.votePower || '0';
    const parsed = parseFloat(String(raw).replace('x', ''));

    return Number.isFinite(parsed) ? parsed : 0;
};

const isValidPhoneNumber = (phoneValue) => {
    const digits = String(phoneValue || '').replace(/\D/g, '');

    return digits.length >= 10 && digits.length <= 15;
};

const isPdfFile = (file) => {
    if (!file) return false;

    const fileName = String(file.name || '').toLowerCase();
    const fileType = String(file.type || '').toLowerCase();

    return fileType === 'application/pdf' || fileName.endsWith('.pdf');
};

const syncCityGate = () => {
    const user = getCurrentUser();
    const cityGate = $('ui-city-selector-container');
    const proposalsContainer = $('proposals-container');

    const needsCity =
        !user.city ||
        user.city === 'Belirsiz' ||
        user.city === 'Seçilmedi' ||
        user.city === 'TRİBÜN SEÇİLMEDİ';

    if (cityGate) {
        cityGate.classList.toggle('hidden', !needsCity);
    }

    if (proposalsContainer) {
        proposalsContainer.classList.remove('hidden');
    }
};

// ======================================================
// 1. EVRENSEL MECLİS KALEMİ - ŞİMDİLİK PASİF
// ======================================================
window.evrenselGeminiDuzelt = function () {
    UI.showToast(
        'Meclis Kalemi yakında aktif olacak. API bağlantısı güvenli backend üzerinden kurulacak.',
        'info'
    );
};

// ======================================================
// 2. ORTAK KÜRSÜ MERKEZİ DAĞITIM MOTORU
// ÖNERGE + SORU
// ======================================================
window.ortakKursuGonder = async function () {
    if (!UI.triggerVerificationGate()) return;

    const user = getCurrentUser();

    if (!user || !user.uid) {
        UI.showToast('Güvenlik hatası: Oturum kimliği doğrulanamadı.', 'error');
        return;
    }

    const mod = STATE.aktifKursuModu || 'onerge';
    const baslik = safeTrimValue('input-kursu-title');
    const hedefKitle = safeValue('input-kursu-audience', 'Herkes');
    const sorumlulukOnay = $('input-kursu-responsibility')?.checked === true;

    if (!sorumlulukOnay) {
        UI.showToast('Sorumluluk beyanını onaylamanız gerekmektedir.', 'error');
        return;
    }

    if (baslik.length < 15 || baslik.length > 150) {
        UI.showToast('Başlık 15 ile 150 karakter arasında olmalıdır.', 'error');
        return;
    }

    const btn = $('btn-submit-kursu');
    const oldText = setButtonLoading(
        btn,
        '<i class="fas fa-spinner fa-spin"></i> İŞLENİYOR...'
    );

    try {
        if (mod === 'onerge') {
            const sorun = safeTrimValue('input-kursu-problem');
            const cozum = safeTrimValue('input-kursu-solution');
            const sure = safeValue('input-kursu-duration', '2');

            if (!sorun || sorun.length < 20) {
                throw new Error('Lütfen sorunu en az 20 karakterle açıklayın.');
            }

            if (!cozum || cozum.length < 20) {
                throw new Error('Lütfen çözüm önerisini en az 20 karakterle açıklayın.');
            }

            await DB.onergeGonder(
                user.uid,
                baslik,
                sorun,
                cozum,
                hedefKitle,
                sure
            );

            UI.showToast('Önergeniz başarıyla meclise sunuldu.', 'success');

            await Me26VotingSystem.loadProposals();

            UI.closeModal('ortak-kursu-modal');
            UI.switchSaasTab('view-sandik');
        }

        if (mod === 'soru') {
            const icerik = safeTrimValue('input-kursu-content');

            if (icerik.length < 50 || icerik.length > 3000) {
                throw new Error('İçerik 50 ile 3000 karakter arasında olmalıdır.');
            }

            const yeniSoru = {
                yazar_uid: user.uid,
                yazar_dijital_id: `TR-IA-${user.userNo || 'ADAY'}`,
                hedef_kitle: hedefKitle,
                baslik,
                icerik,
                cozuldu_mu: false,
                sikayet_sayisi: 0
            };

            const { error } = await supabase
                .from('me26_sorular')
                .insert([yeniSoru]);

            if (error) throw error;

            UI.showToast('Sorunuz ortak akla başarıyla iletildi.', 'success');

            if (typeof window.qaSorulariGetir === 'function') {
                window.qaSorulariGetir();
            }

            UI.closeModal('ortak-kursu-modal');
            UI.switchSaasTab('view-kursu');
        }

        [
            'input-kursu-title',
            'input-kursu-problem',
            'input-kursu-solution',
            'input-kursu-content'
        ].forEach((id) => {
            const el = $(id);
            if (el) el.value = '';
        });

        const responsibility = $('input-kursu-responsibility');
        if (responsibility) responsibility.checked = false;
    } catch (error) {
        console.error('Ortak kürsü gönderim hatası:', error);

        UI.showToast(
            error.message || 'Gönderim sırasında bir hata oluştu.',
            'error'
        );
    } finally {
        restoreButton(btn, oldText || 'Gönder');
    }
};

// ======================================================
// 3. KİMLİK DOĞRULAMA KÖPRÜSÜ
// ======================================================
export const AUTH = {
    loginWithGoogle: async () => {
        try {
            const userData = await googleIleGiris();

            if (userData) {
                window.location.reload();
            }
        } catch (error) {
            console.error('Google giriş köprüsü hatası:', error);
            UI.showToast('Google giriş işlemi başlatılamadı.', 'error');
        }
    },

    logout: async () => {
        await sistemdenCikis();
    },

    resetPhoneModal: () => {
        const step1 = $('phone-step-1');
        const step2 = $('phone-step-2');
        const phoneInput = $('input-phone-number');
        const otpInput = $('input-otp-code');
        const btnPhone = $('btn-submit-phone');
        const btnOtp = $('btn-verify-otp');

        if (step1) {
            step1.style.display = 'block';
            step1.classList.remove('hidden');
        }

        if (step2) {
            step2.style.display = 'none';
            step2.classList.add('hidden');
        }

        if (phoneInput) phoneInput.value = '';
        if (otpInput) otpInput.value = '';

        if (btnPhone) {
            btnPhone.innerHTML = 'SMS GÖNDER';
            btnPhone.disabled = false;
        }

        if (btnOtp) {
            btnOtp.innerHTML = 'KODU ONAYLA';
            btnOtp.disabled = false;
        }
    },

    verifyPhone: async () => {
        const phoneValue = safeValue('input-phone-number', '');

        if (!isValidPhoneNumber(phoneValue)) {
            UI.showToast('Lütfen geçerli bir telefon numarası girin.', 'error');
            return;
        }

        const btn = $('btn-submit-phone');
        const oldText = setButtonLoading(btn, 'BAĞLANIYOR...');

        try {
            await gercekSmsGonder(phoneValue);

            UI.showToast('Kod gönderildi. Lütfen ekrana girin.', 'success');

            const step1 = $('phone-step-1');
            const step2 = $('phone-step-2');

            if (step1) {
                step1.style.display = 'none';
                step1.classList.add('hidden');
            }

            if (step2) {
                step2.style.display = 'block';
                step2.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Telefon doğrulama gönderim hatası:', error);

            UI.showToast(
                error.message || 'SMS gönderilemedi. Lütfen tekrar deneyin.',
                'error'
            );

            restoreButton(btn, oldText || 'SMS GÖNDER');
        }
    },

    verifyOtp: async () => {
        const rawValue = safeValue('input-otp-code', '');
        const otpValue = String(rawValue).replace(/\s+/g, '');

        if (!otpValue || otpValue.length < 6) {
            UI.showToast('6 haneli kodu eksiksiz girin.', 'error');
            return;
        }

        const btn = $('btn-verify-otp');
        const oldText = setButtonLoading(btn, 'DOĞRULANIYOR...');

        try {
            const user = getCurrentUser();

            if (!user || !user.uid) {
                UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
                restoreButton(btn, oldText || 'KODU ONAYLA');
                return;
            }

            const phoneValue = safeValue('input-phone-number', '');

            if (!isValidPhoneNumber(phoneValue)) {
                UI.showToast('Telefon numarası okunamadı. Lütfen işlemi yeniden başlatın.', 'error');
                restoreButton(btn, oldText || 'KODU ONAYLA');
                return;
            }

            await gercekSmsDogrula(otpValue, user.uid, phoneValue);

            UI.showToast('Telefon başarıyla onaylandı.', 'success');

            UI.closeModal('phone-modal');
            UI.renderProfile();
        } catch (error) {
            console.error('OTP doğrulama hatası:', error);

            UI.showToast(
                error.message || 'Hatalı kod girdiniz.',
                'error'
            );

            restoreButton(btn, oldText || 'KODU ONAYLA');
        }
    },

    verifyPdf: async () => {
        const fileInput = $('input-pdf-file');

        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            UI.showToast('Önce bir PDF belge seçin.', 'error');
            return;
        }

        const selectedFile = fileInput.files[0];

        if (!isPdfFile(selectedFile)) {
            UI.showToast('Lütfen yalnızca PDF formatında belge yükleyin.', 'error');
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            UI.showToast('PDF dosyası 10 MB’dan küçük olmalıdır.', 'error');
            return;
        }

        const user = getCurrentUser();

        if (!user || !user.uid) {
            UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }

        const btn = $('btn-submit-pdf');
        const isTerfi = user.authStage === 'pdf_verified';

        const oldText = setButtonLoading(
            btn,
            isTerfi ? 'UNVAN GÜNCELLENİYOR...' : 'İNCELEMEYE GÖNDERİLİYOR...'
        );

        try {
            await eDevletBelgesiOku(selectedFile, user.uid);

            if (isTerfi) {
                UI.showToast(
                    'Belgeniz incelemeye alındı. Onay sonrası unvanınız güncellenecektir.',
                    'success'
                );
            } else {
                UI.showToast(
                    'Belge başvurunuz inceleme kuyruğuna alındı.',
                    'success'
                );
            }

            UI.closeModal('pdf-modal');

            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } catch (error) {
            console.error('PDF başvuru hatası:', error);

            UI.showToast(
                error.message || 'Belge başvurusu sırasında bir hata oluştu.',
                'error'
            );

            restoreButton(btn, oldText || 'BELGE İNCELEME BAŞVURUSU GÖNDER');
        }
    }
};

// ======================================================
// 4. OTONOM SANDIK - OYLAMA MOTORU
// ======================================================
export const Me26VotingSystem = {
    init: function () {
        this.loadProposals();
    },

    loadProposals: async function () {
        try {
            const onergeler = await DB.onergeleriGetir();

            UI.renderProposals(onergeler);

            if (!onergeler || onergeler.length === 0) return;

            onergeler.forEach(async (onerge) => {
                try {
                    const btn = document.querySelector(`button[data-id="${onerge.id}"]`);
                    const cardEl =
                        btn?.closest('.bg-black\\/40') ||
                        btn?.closest('.bg-black\\/50') ||
                        btn?.closest('[data-onerge-card]');

                    if (!cardEl) return;

                    const oylar = await DB.oySonuclariniGetir(onerge.id);

                    this.calculateAndRenderRealVotes(cardEl, oylar);
                } catch (error) {
                    console.error('Oylar çekilemedi:', error);
                }
            });
        } catch (error) {
            console.error('Önergeler yüklenemedi:', error);
        }
    },

    handleVote: async function (btnEl) {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Oy kullanmak için giriş yapmalısınız.', 'error');
            return;
        }

        const user = getCurrentUser();

        if (!user || !user.uid) {
            UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }

        if (!user.hasPhone) {
            UI.showToast('Oy kullanmadan önce Profil sekmesinden telefonunuzu onaylatmalısınız.', 'error');
            return;
        }

        if (user.authStage !== 'pdf_verified') {
            UI.showToast('Oy kullanabilmek için mesleki belgenizi yükleyip tam erişim almalısınız.', 'error');
            return;
        }

        const container = btnEl.closest('.vote-buttons-container');

        if (!container) {
            UI.showToast('Oylama alanı bulunamadı.', 'error');
            return;
        }

        const userRole = user.role ? user.role.toLowerCase() : '';
        const requiredAuth = container.getAttribute('data-auth');

        if (
            requiredAuth === 'icmimar' &&
            !userRole.includes('içmimar') &&
            !userRole.includes('icmimar') &&
            !userRole.includes('mimar')
        ) {
            UI.showToast('Bu sandığı sadece İçmimarlık Mezunları oylayabilir.', 'error');
            return;
        }

        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) {
            UI.showToast('Bu sandık sadece İçmimarlık Öğrencileri içindir.', 'error');
            return;
        }

        const currentPower = getVotePowerNumber(user);

        if (currentPower <= 0) {
            UI.showToast('Oy gücünüz henüz aktif değil. Profil panelinden sicilinizi tamamlayın.', 'error');
            return;
        }

        const onergeId =
            btnEl.getAttribute('data-onerge-id') ||
            btnEl.getAttribute('data-id') ||
            btnEl.closest('[data-id]')?.getAttribute('data-id');

        const choice = btnEl.getAttribute('data-vote');

        if (!onergeId || !choice) {
            UI.showToast('Oylama kimliği okunamadı.', 'error');
            return;
        }

        const originalHtml = btnEl.innerHTML;

        btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btnEl.disabled = true;

        try {
            await DB.oyKullan(user.uid, onergeId, choice, currentPower);

            const allButtons = container.querySelectorAll('.vote-btn');

            allButtons.forEach((button) => {
                button.disabled = true;
                button.classList.remove(
                    'hover:border-green-500',
                    'hover:border-yellow-500',
                    'hover:border-red-500',
                    'hover:bg-slate-700'
                );
                button.classList.add('opacity-30', 'cursor-not-allowed');
            });

            btnEl.classList.remove('opacity-30', 'bg-slate-800', 'text-gray-400');

            if (choice === 'yes') {
                btnEl.classList.add('bg-green-900/60', 'border-green-500', 'text-green-400');
            }

            if (choice === 'abstain') {
                btnEl.classList.add('bg-yellow-900/60', 'border-yellow-500', 'text-yellow-400');
            }

            if (choice === 'no') {
                btnEl.classList.add('bg-red-900/60', 'border-red-500', 'text-red-400');
            }

            btnEl.innerHTML = originalHtml;

            const guncelOylar = await DB.oySonuclariniGetir(onergeId);
            const cardEl = container.closest('[data-onerge-card]') || container.parentElement;

            this.calculateAndRenderRealVotes(cardEl, guncelOylar);

            UI.showToast('Oyunuz başarıyla mühürlendi.', 'success');
        } catch (error) {
            console.error('Oy gönderim hatası:', error);

            btnEl.innerHTML = originalHtml;
            btnEl.disabled = false;

            if (error.message === 'already_voted') {
                UI.showToast('Bu önergeye zaten oy verdiniz. Sistem ikinci oyu engeller.', 'info');

                container.querySelectorAll('.vote-btn').forEach((button) => {
                    button.disabled = true;
                    button.classList.add('opacity-30', 'cursor-not-allowed');
                });
            } else {
                UI.showToast('Oy gönderilirken bir hata oluştu.', 'error');
            }
        }
    },

    calculateAndRenderRealVotes: function (cardEl, oylarDizisi) {
        if (!cardEl || !oylarDizisi) return;

        let totalYesPower = 0;
        let totalNoPower = 0;
        let totalAbstainPower = 0;

        oylarDizisi.forEach((oy) => {
            const guc = Number(oy.oy_gucu) || 0;

            if (oy.kullanilan_oy === 'yes') totalYesPower += guc;
            if (oy.kullanilan_oy === 'no') totalNoPower += guc;
            if (oy.kullanilan_oy === 'abstain') totalAbstainPower += guc;
        });

        const totalPower = totalYesPower + totalNoPower + totalAbstainPower;

        let pY = 0;
        let pN = 0;
        let pA = 0;

        if (totalPower > 0) {
            pY = Math.round((totalYesPower / totalPower) * 100);
            pA = Math.round((totalAbstainPower / totalPower) * 100);
            pN = 100 - (pY + pA);
        }

        const barY = cardEl.querySelector('.vote-bar-yes');
        const barA = cardEl.querySelector('.vote-bar-abstain');
        const barN = cardEl.querySelector('.vote-bar-no');

        if (barY) barY.style.width = `${pY}%`;
        if (barA) barA.style.width = `${pA}%`;
        if (barN) barN.style.width = `${pN}%`;

        const textY = cardEl.querySelector('.vote-text-yes');
        const textA = cardEl.querySelector('.vote-text-abstain');
        const textN = cardEl.querySelector('.vote-text-no');

        if (textY) textY.textContent = `%${pY} Kabul`;
        if (textA) textA.textContent = `%${pA} Çekimser`;
        if (textN) textN.textContent = `%${pN} Ret`;
    }
};

// ======================================================
// 5. TRİBÜN LİGİ
// ======================================================
function tribunLigiFonksiyonunuKur() {
    window.loadTribunLigiData = async () => {
        try {
            const realCityData = await DB.tribunLigiGetir();

            if (typeof UI.renderTribunLigi === 'function') {
                UI.renderTribunLigi(realCityData);
            }
        } catch (error) {
            console.error('Tribün Ligi canlı verileri çekilemedi:', error);
        }
    };
}

// ======================================================
// 6. STATİK BUTON DİNLEYİCİLERİ
// ======================================================
function statikDinleyicileriBagla() {
    [
        'btn-register-hero',
        'btn-register-nav',
        'btn-login-hero',
        'btn-login-nav'
    ].forEach((id) => {
        bind(id, 'click', AUTH.loginWithGoogle);
    });

    document.querySelectorAll('.nav-menu-btn').forEach((btn) => {
        if (btn.dataset.bound === '1') return;

        btn.dataset.bound = '1';

        btn.addEventListener('click', (event) => {
            const targetId = event.currentTarget.getAttribute('data-target');

            if (!targetId) return;

            UI.switchSaasTab(targetId);

            if (window.innerWidth < 768) {
                document.querySelectorAll('.nav-menu-btn i').forEach((icon) => {
                    icon.classList.remove('text-kaos');
                });

                event.currentTarget.querySelector('i')?.classList.add('text-kaos');
            }
        });
    });

    bind('btn-save-profile-city', 'click', async () => {
        const user = getCurrentUser();

        if (!user || !user.uid) {
            UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }

        const selectedCity = safeValue('input-profile-city', '');

        if (!selectedCity) {
            UI.showToast('Tribün seçimi yapmalısınız.', 'error');
            return;
        }

        try {
            await DB.sehirGuncelle(user.uid, selectedCity);

            STATE.setCity(selectedCity);
            UI.renderProfile();
            syncCityGate();

            UI.showToast(`Harika. ${selectedCity} tribününe katıldınız.`, 'success');

            if (typeof window.loadTribunLigiData === 'function') {
                window.loadTribunLigiData();
            }

            await Me26VotingSystem.loadProposals();
        } catch (error) {
            console.error('Şehir kaydetme hatası:', error);
            UI.showToast('Şehir kaydedilemedi.', 'error');
        }
    });

    bind('btn-standart-numara', 'click', async () => {
        const user = getCurrentUser();

        if (!user || !user.uid) {
            UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }

        if (!confirm('Sıradaki boş numarayı otomatik almak istediğinize emin misiniz?')) {
            return;
        }

        try {
            const yeniNo = await DB.standartNumaraAl(user.uid);

            STATE.setStandardNumber(yeniNo);
            UI.renderProfile();

            UI.showToast(`Numaranız atandı: TR-IA-${yeniNo}`, 'success');
        } catch (error) {
            console.error('Standart numara hatası:', error);
            UI.showToast('Numara alınamadı.', 'error');
        }
    });

    bind('btn-open-proposal-modal', 'click', () => {
        UI.openKursuModal();
        UI.switchKursuTab('onerge');
    });

    bind('btn-open-qa-modal', 'click', () => {
        UI.openKursuModal();
        UI.switchKursuTab('soru');
    });

    bind('btn-close-kursu-modal', 'click', () => UI.closeModal('ortak-kursu-modal'));
    bind('tab-btn-onerge', 'click', () => UI.switchKursuTab('onerge'));
    bind('tab-btn-soru', 'click', () => UI.switchKursuTab('soru'));
    bind('btn-submit-kursu', 'click', window.ortakKursuGonder);

    bind('btn-open-phone-modal', 'click', () => {
        AUTH.resetPhoneModal();
        UI.openModal('phone-modal');
    });

    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));

    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-submit-pdf', 'click', AUTH.verifyPdf);

    bind('btn-open-vip-modal', 'click', () => {
        UI.openModal('vip-modal');

        if (VIP && typeof VIP.updateModalState === 'function') {
            VIP.updateModalState();
        }
    });

    bind('btn-close-vip-modal', 'click', () => UI.closeModal('vip-modal'));

    bind('btn-claim-vip-number', 'click', () => {
        if (VIP && typeof VIP.claimNumber === 'function') {
            VIP.claimNumber();
        }
    });

    bind('btn-whatsapp-share', 'click', () => {
        if (VIP && typeof VIP.handleShare === 'function') {
            VIP.handleShare(true);
        }
    });

    bind('btn-copy-invite', 'click', () => {
        if (VIP && typeof VIP.handleShare === 'function') {
            VIP.handleShare(false);
        }
    });

    bind('btn-logout', 'click', AUTH.logout);
}

// ======================================================
// 7. DİNAMİK BUTON DİNLEYİCİLERİ
// Destekle, Oyla, SMS
// ======================================================
function dinamikDinleyicileriBagla() {
    if (document.body.dataset.me26DynamicBound === '1') return;

    document.body.dataset.me26DynamicBound = '1';

    document.body.addEventListener('click', (event) => {
        const target = event.target;
        const clickedEl = target instanceof Element ? target : null;

        if (!clickedEl) return;

        const phoneSubmitBtn = clickedEl.closest('#btn-submit-phone');
        const otpSubmitBtn = clickedEl.closest('#btn-verify-otp');
        const voteBtn = clickedEl.closest('.vote-btn');
        const destekBtn = clickedEl.closest('.btn-destekle');

        if (phoneSubmitBtn) {
            event.preventDefault();
            AUTH.verifyPhone();
            return;
        }

        if (otpSubmitBtn) {
            event.preventDefault();
            AUTH.verifyOtp();
            return;
        }

        if (voteBtn) {
            event.preventDefault();
            Me26VotingSystem.handleVote(voteBtn);
            return;
        }

        if (destekBtn) {
            event.preventDefault();
            handleDestekle(destekBtn);
        }
    });
}

async function handleDestekle(destekBtn) {
    if (!STATE.isLoggedIn()) {
        UI.showToast('Destek vermek için giriş yapmalısınız.', 'error');
        return;
    }

    const user = getCurrentUser();

    if (!user || !user.uid) {
        UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
        return;
    }

    if (!user.hasPhone || user.authStage !== 'pdf_verified') {
        UI.showToast(
            'Önergeyi destekleyebilmek için Profil sekmesinden telefon ve mesleki belge onaylarınızı tamamlamalısınız.',
            'error'
        );
        return;
    }

    const onergeId = destekBtn.getAttribute('data-id');

    if (!onergeId) {
        UI.showToast('Önerge kimliği okunamadı.', 'error');
        return;
    }

    const originalText = destekBtn.innerHTML;

    destekBtn.innerHTML = '...';
    destekBtn.disabled = true;

    try {
        await DB.destekVer(user.uid, onergeId);

        UI.showToast('Önergeye destek verdiniz.', 'success');

        await Me26VotingSystem.loadProposals();
    } catch (error) {
        console.error('Destek verme hatası:', error);

        if (error.message === 'already_supported') {
            UI.showToast('Bu önergeyi zaten desteklediniz.', 'info');

            destekBtn.innerHTML = 'DESTEKLENDİ';
            destekBtn.classList.remove('bg-slate-800', 'border-slate-500', 'hover:bg-slate-700');
            destekBtn.classList.add('bg-green-900/50', 'text-green-400', 'border-green-500');
        } else {
            UI.showToast('Bir hata oluştu.', 'error');

            destekBtn.innerHTML = originalText;
            destekBtn.disabled = false;
        }
    }
}

// ======================================================
// 8. OTURUM ROUTER'I
// ======================================================
function authRouterKur() {
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            STATE.clearSession();

            UI.showView('landing');

            try {
                UI.renderProfile();
            } catch (error) {
                // Girişsiz durumda profil render edilmezse sorun değil.
            }

            return;
        }

        try {
            const { data: dbUser, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', firebaseUser.uid)
                .maybeSingle();

            if (error) throw error;

            if (!dbUser) {
                UI.showToast(
                    'Kullanıcı kaydı bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.',
                    'error'
                );

                UI.showView('landing');
                return;
            }

            STATE.setUser({
                uid: dbUser.id,
                name: dbUser.isim,
                email: dbUser.email,
                photo: dbUser.foto,
                city: dbUser.sehir || 'Belirsiz',
                role: dbUser.mesleki_durum || 'Belirsiz',
                votePower: `${dbUser.oy_gucu || 0}x`,
                userNo: dbUser.vip_kurucu_no || 'BEKLEYEN',
                davetKodu: dbUser.kendi_davet_kodu,
                hasPhone: Boolean(dbUser.telefon),
                authStage:
                    dbUser.belge_durumu === 'Onaylandı'
                        ? 'pdf_verified'
                        : dbUser.belge_durumu === 'Onay Bekliyor'
                            ? 'document_pending'
                            : Boolean(dbUser.telefon)
                                ? 'phone_verified'
                                : 'registered',
                inviteCount: dbUser.davet_edilen_kisi_sayisi || 0,
                isVip: dbUser.is_vip || false
            });

            UI.showView('saas');
            UI.switchSaasTab('view-lobi');
            UI.renderProfile();
            syncCityGate();

            await Me26VotingSystem.loadProposals();

            if (typeof window.loadTribunLigiData === 'function') {
                window.loadTribunLigiData();
            }

            if (STADYUM && typeof STADYUM.baslat === 'function') {
                STADYUM.baslat();
            }
        } catch (error) {
            console.error('Oturum yönlendirme hatası:', error);

            UI.showToast(
                'Oturum bilgileri alınamadı. Lütfen sayfayı yenileyin.',
                'error'
            );
        }
    });
}

// ======================================================
// 9. BAŞLATMA
// ======================================================
let me26AppStarted = false;

function santiyeyiBaslat() {
    if (me26AppStarted) return;

    me26AppStarted = true;

    tribunLigiFonksiyonunuKur();

    try {
        Me26VotingSystem.init();
    } catch (error) {
        console.error('Sandık motoru başlatılamadı:', error);
    }

    try {
        if (KORUMA && typeof KORUMA.baslat === 'function') {
            KORUMA.baslat();
        }
    } catch (error) {
        console.error('Koruma Hattı başlatılamadı:', error);
    }

    statikDinleyicileriBagla();
    dinamikDinleyicileriBagla();
    authRouterKur();

    if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
    }

    console.info('ME26 app.js başlatıldı.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', santiyeyiBaslat);
} else {
    santiyeyiBaslat();
}
