/* ==========================================================================
   ME26 AĞI - GİZLİ VERİTABANI MOTORU (supabase.js)
   Tablo ve sütun isimlerini gizleyen RPC (Karanlık Oda) mimarisi
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

export const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey);

export const DB = {
    // 1. SİSTEME GİRİŞ MOTORU (AKILLANDIRILDI)
    sistemeGiris: async (gizliPaket) => {
        // ÖNCE KONTROL: Bu adam zaten sistemde var mı?
        const { data: mevcutUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', gizliPaket.uid)
            .single();

        // Eğer adam içeride varsa, kendi elle girdiğin "1.0" ve "Şehir" gibi gerçek verilerini ezmeden direkt al!
        if (mevcutUser) {
            return mevcutUser;
        }

        // Eğer adam ilk kez geliyorsa, o zaman karanlık odaya (RPC) yeni kayıt olarak gönder
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
    }
};            throw error; // UI.js tarafında hata mesajı (Toast) göstermek için fırlatıyoruz
        }
    }
};
