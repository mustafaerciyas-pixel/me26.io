/* ==========================================================================
   ME26 AĞI - VERİTABANI MOTORU (supabase.js)
   Google ve E-Devlet verilerini kalıcı olarak Supabase'e yazar.
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

// Supabase İstemcisini Başlat
export const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey);

export const DB = {
    // 1. Kullanıcı Supabase'de var mı kontrol et
    getUser: async (googleId) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', googleId)
            .single();
            
        if (error && error.code !== 'PGRST116') console.error('DB GetUser Hatası:', error);
        return data;
    },

    // 2. Yeni Kullanıcı Oluştur (Google'dan ilk defa geliyorsa)
    createUser: async (userData) => {
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    id: userData.id,
                    google_isim: userData.google_isim,
                    email: userData.email,
                    profil_foto: userData.profil_foto,
                    mesleki_durum: userData.mesleki_durum,
                    sehir_tribunu: userData.sehir_tribunu,
                    kendi_davet_kodu: userData.kendi_davet_kodu,
                    referans_kodu: userData.referans_kodu, // Kimin linkiyle geldi?
                    oy_gucu: 0.0,
                    basarili_davet_sayisi: 0,
                    belge_onay_durumu: 'Bekliyor'
                }
            ])
            .select()
            .single();

        if (error) console.error('DB CreateUser Hatası:', error);
        
        // Eğer bu kişi birinin referansıyla geldiyse, o kişinin davet sayısını 1 artır
        if (userData.referans_kodu) {
            await DB.incrementReferral(userData.referans_kodu);
        }
        
        return data;
    },

    // 3. Davet Edenin Sayacını Artır (Büyüme Motoru)
    incrementReferral: async (referansKodu) => {
        // Önce referans kodunun sahibini bul
        const { data: inviter } = await supabase
            .from('users')
            .select('id, basarili_davet_sayisi')
            .eq('kendi_davet_kodu', referansKodu)
            .single();

        if (inviter) {
            // Davet sayısını +1 yap
            await supabase
                .from('users')
                .update({ basarili_davet_sayisi: inviter.basarili_davet_sayisi + 1 })
                .eq('id', inviter.id);
        }
    },

    // 4. Kullanıcı Verisini Güncelle (Telefon onayı, e-devlet, VIP no vb. için)
    updateUser: async (googleId, updates) => {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', googleId)
            .select()
            .single();

        if (error) console.error('DB UpdateUser Hatası:', error);
        return data;
    }
};
