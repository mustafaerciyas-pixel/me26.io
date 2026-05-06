/* ==========================================================================
   ME26 AĞI - İÇMİMAR KORUMA HATTI MOTORU (koruma.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Amaç:
   - Ünvan kullanımı, belge kontrolü ve şüpheli mesleki temsil bildirimlerini
     güvenli şekilde ön inceleme kuyruğuna almak.
   - ME26 kesin hüküm vermez; yalnızca belgeye dayalı bildirimleri kayıt altına alır.
   - Dosya yükleme altyapısı aktif değilse dosya seçimini sessizce yok saymaz.
   ========================================================================== */

import { DB } from './supabase.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const cleanText = (value) => {
    return String(value || '').trim();
};

const getValue = (id) => {
    const el = $(id);
    return el ? cleanText(el.value) : '';
};

const getChecked = (id) => {
    const el = $(id);
    return Boolean(el && el.checked);
};

const setValue = (id, value = '') => {
    const el = $(id);
    if (el) el.value = value;
};

const setChecked = (id, checked = false) => {
    const el = $(id);
    if (el) el.checked = checked;
};

const isValidOptionalUrl = (value) => {
    const link = cleanText(value);

    if (!link) return true;

    try {
        const url = new URL(link);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
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

const getBildirenKimlik = () => {
    if (!STATE.isLoggedIn()) {
        return 'TR-IA-ZİYARETÇİ';
    }

    const user = STATE.getUser ? STATE.getUser() : STATE.user;

    if (!user) {
        return 'TR-IA-ZİYARETÇİ';
    }

    if (user.userNo && user.userNo !== 'BEKLEYEN') {
        return `TR-IA-${user.userNo}`;
    }

    if (user.uid) {
        return `UID-${user.uid}`;
    }

    return 'TR-IA-ZİYARETÇİ';
};

const clearKorumaForm = () => {
    setValue('input-koruma-kisi', '');
    setValue('input-koruma-link', '');
    setValue('input-koruma-aciklama', '');
    setValue('input-koruma-ad', '');
    setValue('input-koruma-iletisim', '');

    setChecked('input-koruma-anonim', false);
    setChecked('input-koruma-kvkk', false);

    const fileInput = $('input-koruma-belge');

    if (fileInput) {
        fileInput.value = '';
    }
};

const closeKorumaForm = () => {
    const formAlan = $('koruma-form-alan');

    if (formAlan) {
        formAlan.classList.add('hidden');
    }
};

// ======================================================
// KORUMA MOTORU
// ======================================================
export const KORUMA = {
    baslat: function () {
        const btnSubmit = $('btn-submit-koruma');

        if (btnSubmit) {
            btnSubmit.removeAttribute('onclick');

            btnSubmit.addEventListener('click', () => {
                this.bildirimGonder();
            });
        }

        const fileInput = $('input-koruma-belge');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    UI.showToast(
                        'Dosya yükleme canlıda henüz aktif değil. Lütfen delil bağlantısını Web Sitesi / Sosyal Medya alanına ekleyin.',
                        'info'
                    );
                }
            });
        }
    },

    bildirimGonder: async function () {
        const tur = getValue('input-koruma-turu');
        const kisiKurum = getValue('input-koruma-kisi');
        const link = getValue('input-koruma-link');
        const aciklama = getValue('input-koruma-aciklama');
        const anonimMi = getChecked('input-koruma-anonim');
        const kvkkOnay = getChecked('input-koruma-kvkk');

        let adSoyad = getValue('input-koruma-ad');
        let iletisim = getValue('input-koruma-iletisim');

        const fileInput = $('input-koruma-belge');
        const hasFile = Boolean(fileInput && fileInput.files && fileInput.files.length > 0);

        // --------------------------------------------------
        // CANLI GÜVENLİK NOTU
        // --------------------------------------------------
        // Şu an projede Supabase Storage dosya yükleme akışı yok.
        // Dosya seçilirse sessizce yok saymak güven kırar.
        // Bu yüzden dosya seçimini engelliyoruz ve kullanıcıyı link alanına yönlendiriyoruz.
        if (hasFile) {
            UI.showToast(
                'Delil dosyası yükleme altyapısı henüz aktif değil. Lütfen delil bağlantısını Web Sitesi / Sosyal Medya alanına ekleyin.',
                'error'
            );
            return;
        }

        // --------------------------------------------------
        // VALIDASYONLAR
        // --------------------------------------------------
        if (!tur) {
            UI.showToast('Lütfen bildirim türünü seçin.', 'error');
            return;
        }

        if (!kisiKurum || kisiKurum.length < 2) {
            UI.showToast('Lütfen bildirilen kişi veya kurumu yazın.', 'error');
            return;
        }

        if (!isValidOptionalUrl(link)) {
            UI.showToast('Lütfen geçerli bir web sitesi veya sosyal medya bağlantısı girin.', 'error');
            return;
        }

        if (!aciklama || aciklama.length < 30) {
            UI.showToast('Lütfen durumu en az 30 karakterle objektif şekilde açıklayın.', 'error');
            return;
        }

        if (aciklama.length > 3000) {
            UI.showToast('Açıklama 3000 karakterden kısa olmalıdır.', 'error');
            return;
        }

        if (!kvkkOnay) {
            UI.showToast('İlerlemek için doğruluk beyanını onaylamalısınız.', 'error');
            return;
        }

        if (anonimMi) {
            adSoyad = '';
            iletisim = '';
        }

        const btnSubmit = $('btn-submit-koruma');
        const eskiMetin = setButtonLoading(
            btnSubmit,
            '<i class="fas fa-spinner fa-spin"></i> GÜVENLİ AĞA İLETİLİYOR...'
        );

        try {
            const payload = {
                bildiren_uid: getBildirenKimlik(),
                bildirim_turu: tur,
                sikayet_edilen: kisiKurum,
                baglanti: link || null,
                aciklama,
                ad_soyad: adSoyad || null,
                iletisim: iletisim || null,
                anonim_mi: anonimMi
            };

            await DB.korumaBildir(payload);

            UI.showToast(
                'Bildiriminiz ön inceleme kuyruğuna alındı. ME26 kesin hüküm vermez; kayıt belgeye dayalı değerlendirme içindir.',
                'success'
            );

            clearKorumaForm();
            closeKorumaForm();
        } catch (error) {
            console.error('Koruma Hattı Hatası:', error);

            if (error.message === 'missing_koruma_type') {
                UI.showToast('Bildirim türü eksik.', 'error');
                return;
            }

            if (error.message === 'missing_koruma_target') {
                UI.showToast('Bildirilen kişi veya kurum eksik.', 'error');
                return;
            }

            if (error.message === 'koruma_description_too_short') {
                UI.showToast('Açıklama yeterince detaylı değil.', 'error');
                return;
            }

            UI.showToast(
                'Bildirim iletilemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.',
                'error'
            );
        } finally {
            restoreButton(btnSubmit, eskiMetin || 'BİLDİRİMİ GÜVENLİ AĞA İLET');
        }
    }
};
