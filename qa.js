/* ==========================================================================
   ME26 ORTAK AKIL KÜTÜPHANESİ - ÇIPLAK MOD (HATA TESPİTİ İÇİN)
   qa.js
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js'; 
import { UI } from './ui.js'; 

window.UI = UI;

let aktifQaSekme = 'bekleyenler';
let aktifSoruId = null;

function qaMotorunuBaslat() {
    document.getElementById('btn-qa-bekleyenler')?.addEventListener('click', window.qaSorulariGetir);
    document.getElementById('btn-qa-kutuphane')?.addEventListener('click', window.qaSorulariGetir);
    
    window.qaSorulariGetir();
}

if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', qaMotorunuBaslat); 
} else { 
    qaMotorunuBaslat(); 
}

function aktifKullaniciyiAl() {
    if (!STATE.isLoggedIn() || !STATE.user) return null;

    let rol = 'İçmimar';
    if(STATE.user.role && STATE.user.role.toLowerCase().includes('öğrenci')) rol = 'Öğrenci';

    let dijitalId = 'TR-IA-BEKLEYEN';
    if(STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN') dijitalId = `TR-IA-${STATE.user.userNo}`;

    return {
        uid: STATE.user.uid,
        dijital_id: dijitalId,
        rol: rol
    };
}

// SIFIR FİLTRE, SIFIR TASARIM ZORLAMASI. SADECE HAM VERİ!
window.qaSorulariGetir = async function() {
    const list = document.getElementById('qa-listesi');
    if(!list) return;
    
    list.innerHTML = '<div class="text-kaos text-center py-5 font-black text-lg animate-pulse">Sistem Taranıyor... (Çıplak Mod)</div>';

    try {
        // Tabloda ne var ne yoksa zorla getir (RLS kapalı olduğu için hepsini çekmeli)
        const { data, error } = await supabase.from('me26_sorular').select('*');
        
        if (error) {
            list.innerHTML = `<div class="bg-red-500 text-white p-4 rounded-xl font-bold">SUPABASE HATASI: ${error.message}</div>`;
            return;
        }

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="bg-yellow-600 text-white p-6 rounded-xl font-black text-center text-lg shadow-xl">
                ⚠️ DİKKAT: Supabase tablosu arayüze BOMBOŞ dönüyor! (Veri Sıfır)
            </div>`;
            return;
        }

        // Ekrana dümdüz, hatasız basma garantili HTML
        let html = `<div class="bg-green-600 text-white p-4 rounded-xl mb-4 font-black text-center text-sm shadow-[0_0_20px_rgba(22,163,74,0.6)]">
            ✅ BAŞARILI! Veritabanından ${data.length} adet soru çekildi.
        </div>`;
        
        data.forEach(soru => {
            html += `
            <div class="bg-slate-900 border-2 border-kaos p-6 rounded-2xl mb-4 shadow-lg">
                <div class="text-kaos text-xs font-black uppercase tracking-widest mb-2 border-b border-slate-700 pb-2 flex justify-between">
                    <span>Soran: ${soru.yazar_dijital_id || 'Bilinmiyor'}</span>
                    <span>${soru.cozuldu_mu ? '✅ ÇÖZÜLDÜ' : '⏳ BEKLİYOR'}</span>
                </div>
                <h4 class="text-xl font-black text-white mb-3">${soru.baslik || 'Başlık Yok'}</h4>
                <p class="text-base text-gray-300 mb-4">${soru.icerik || 'İçerik Yok'}</p>
                <button onclick="qaSoruDetayAc('${soru.id}')" class="bg-kaos text-slate-900 font-black px-4 py-3 rounded-lg text-xs uppercase w-full shadow-md">Detay / Cevap Yaz</button>
            </div>`;
        });

        list.innerHTML = html;

    } catch (err) {
        list.innerHTML = `<div class="bg-red-500 text-white p-4 rounded-xl font-bold">JAVASCRIPT ÇÖKTÜ: ${err.message}</div>`;
    }
};

// Modal'ı açmak için geçici, çökmez fonksiyon (Teşhis için)
window.qaSoruDetayAc = async function(soruId) {
    alert("Soru ID: " + soruId + "\n\nŞefim, sorular ekrana geldiyse hata eski UI tasarımlarındaymış! Detay sayfası şimdilik teşhis için kapalı. Ekranda yeşil renkli BAŞARILI yazısını gördün mü, onu söyle yeter!");
};

// Diğer butonlar hata vermesin diye boş tanımladık
window.qaCevapGonder = async function() {};
window.qaCozumİsaretle = async function() {};
window.qaUygunsuzBildir = async function() {};
