/* ==========================================================================
   ME26 AĞI - GİZLİ VERİTABANI MOTORU (supabase.js)
   Tablo ve sütun isimlerini gizleyen RPC (Karanlık Oda) mimarisi
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

export const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey);

export const DB = {
    // Sokağa sır vermeyen, veriyi paketleyip karanlık odaya (RPC) atan fonksiyon
    sistemeGiris: async (gizliPaket) => {
        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });
        if (error) console.error('Giriş Motoru Hatası:', error);
        return data;
    },

    telefonuOnayla: async (uid, telNo) => {
        const { error } = await supabase.rpc('me26_telefon_onay', { p_uid: uid, p_tel: telNo });
        if (error) console.error('Telefon Motoru Hatası:', error);
    },

    belgeyiSirayaAl: async (uid, belgeData) => {
        // Tüm detaylar 'belgeData' isimli tek bir şifreli paket (JSON) olarak gider
        const { error } = await supabase.rpc('me26_belge_yukle', { 
            p_uid: uid, 
            p_data: belgeData 
        });
        if (error) console.error('Belge Motoru Hatası:', error);
    }
};
