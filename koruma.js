/* ==========================================================================
   ME26 AĞI - İÇMİMAR KORUMA HATTI MOTORU (koruma.js)
   Bildirimleri Supabase veritabanına iletir. Dosya yükleme canlı güvenlik onayı tamamlanana kadar pasiftir.
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

export const KORUMA = {
    baslat: function() {
        const btnSubmit = document.getElementById('btn-submit-koruma');
        if (btnSubmit) {
            // Önceki alert vb. varsa temizle ve kendi fonksiyonumuzu bağla
            btnSubmit.removeAttribute('onclick'); 
            btnSubmit.addEventListener('click', () => this.bildirimGonder());
        }
    },

    bildirimGonder: async function() {
        // Form Alanlarını Yakala
        const tur = document.getElementById('input-koruma-turu')?.value;
        const kisiKurum = document.getElementById('input-koruma-kisi')?.value.trim();
        const link = document.getElementById('input-koruma-link')?.value.trim();
        const aciklama = document.getElementById('input-koruma-aciklama')?.value.trim();
        const adSoyad = document.getElementById('input-koruma-ad')?.value.trim();
        const iletisim = document.getElementById('input-koruma-iletisim')?.value.trim();
        const anonimMi = document.getElementById('input-koruma-anonim')?.checked;
        const kvkkOnay = document.getElementById('input-koruma-kvkk')?.checked;
        const belgeInput = document.getElementById('input-koruma-belge');

        if (belgeInput && belgeInput.files && belgeInput.files.length > 0) {
            belgeInput.value = '';
            UI.showToast("Dosya yükleme canlı güvenlik denetimi tamamlanana kadar pasiftir. Lütfen delil bağlantısını açıklama/link alanına yazın.", "info");
        }

        // Validasyonlar (Zorunlu Alanlar)
        if (!kisiKurum) return UI.showToast("Lütfen bildirilen kişi veya kurumu yazın.", "error");
        if (!aciklama || aciklama.length < 20) return UI.showToast("Lütfen durumu en az 20 karakterle açıklayın.", "error");
        if (!kvkkOnay) return UI.showToast("İlerlemek için doğruluk beyanını (KVKK) onaylamalısınız.", "error");

        // Gönderici Kimliğini Belirle
        let myUserId = 'TR-IA-ZİYARETÇİ';
        if (STATE.isLoggedIn() && STATE.user && STATE.user.userNo) {
            myUserId = `TR-IA-${STATE.user.userNo}`;
        }

        // Butonu Kilitle (Yükleniyor durumu)
        const btnSubmit = document.getElementById('btn-submit-koruma');
        const orijinalMetin = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ŞİFRELENİYOR...';
        btnSubmit.disabled = true;

        try {
            // Supabase'e Veriyi Gönder
            const { error } = await supabase
                .from('me26_koruma_hatti')
                .insert([
                    {
                        bildiren_uid: myUserId,
                        bildirim_turu: tur,
                        sikayet_edilen: kisiKurum,
                        baglanti: link,
                        aciklama: aciklama,
                        ad_soyad: adSoyad,
                        iletisim: iletisim,
                        anonim_mi: anonimMi,
                        dosya_yukleme_durumu: "pasif_yazili_bildirim"
                    }
                ]);

            if (error) throw error;

            // Başarılı Senaryo
            UI.showToast("Bildiriminiz başarıyla şifrelenip merkeze iletildi.", "success");
            
            // Formu Temizle ve Kapat
            document.getElementById('input-koruma-kisi').value = '';
            document.getElementById('input-koruma-link').value = '';
            document.getElementById('input-koruma-aciklama').value = '';
            document.getElementById('input-koruma-kvkk').checked = false;
            document.getElementById('koruma-form-alan').classList.add('hidden');

        } catch (error) {
            console.error("Koruma Hattı Hatası:", error);
            UI.showToast("Bildirim iletilemedi. Lütfen bağlantınızı kontrol edin.", "error");
        } finally {
            // Butonu Geri Aç
            btnSubmit.innerHTML = orijinalMetin;
            btnSubmit.disabled = false;
        }
    }
};
