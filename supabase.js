/* ==========================================================================
   ME26 AĞI - GİZLİ VERİTABANI MOTORU (supabase.js)
   Tablo ve sütun isimlerini gizleyen RPC (Karanlık Oda) mimarisi
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

export const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey);

export const DB = {
    // 1. SİSTEME GİRİŞ MOTORU (AKILLANDIRILDI - maybeSingle Eklendi)
    sistemeGiris: async (gizliPaket) => {
        // ÖNCE KONTROL: Bu adam zaten sistemde var mı?
        const { data: mevcutUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', gizliPaket.uid)
            .maybeSingle(); // <--- KRİTİK DÜZELTME BURADA (single yerine maybeSingle)

        // Adam içeride varsa, gerçek verilerini (Onay, Güç vb.) ezmeden al
        if (mevcutUser) {
            return mevcutUser;
        }

        // İlk kez geliyorsa ve bulamadıysa karanlık odaya (RPC) yeni kayıt için gönder
        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });
        if (error) console.error('🔥 Giriş Motoru Hatası:', error.message);
        return data;
    },

    // 2. TELEFON ONAY MOTORU
    telefonuOnayla: async (uid, telNo) => {
        const { error } = await supabase.rpc('me26_telefon_onay', { p_uid: uid, p_tel: telNo });
        if (error) console.error('🔥 Telefon Motoru Hatası:', error.message);
    },

    // 3. E-DEVLET BELGE MOTORU
    belgeyiSirayaAl: async (uid, belgeData) => {
        const { error } = await supabase.rpc('me26_belge_yukle', { 
            p_uid: uid, 
            p_data: belgeData 
        });
        
        if (error) {
            console.error('🔥 SUPABASE ASIL HATA:', error.message);
        } else {
            console.log('✅ BELGE VERİTABANINA BAŞARIYLA YAZILDI!');
        }
    },

    // 4. GÖREV 1: ŞEHİR (TRİBÜN) GÜNCELLEME MOTORU
    sehirGuncelle: async (uid, secilenSehir) => {
        const { error } = await supabase.rpc('me26_sehir_guncelle', { 
            p_uid: uid, 
            p_sehir: secilenSehir 
        });

        if (error) {
            console.error('🔥 Şehir Güncelleme Hatası:', error.message);
            throw error;
        }
    },

    // 5. VIP İSTEMEYENLERE STANDART NUMARA ATAMA MOTORU
    standartNumaraAl: async (uid) => {
        const { data, error } = await supabase.rpc('me26_standart_numara_al', { p_uid: uid });
        
        if (error) {
            console.error('🔥 Standart Numara Hatası:', error.message);
            throw error;
        }
        return data; 
    }
};
