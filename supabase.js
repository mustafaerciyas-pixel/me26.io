/* ==========================================================================
   ME26 AĞI - GİZLİ VERİTABANI MOTORU (supabase.js)
   Canlı Yayın (Production) Sürümü - Kesin Hata Fırlatma (Throw Error) Mimarisi
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

export const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey);

export const DB = {
    // 1. SİSTEME GİRİŞ MOTORU
    sistemeGiris: async (gizliPaket) => {
        const { data: mevcutUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('id', gizliPaket.uid)
            .maybeSingle(); 

        if (selectError) throw selectError;

        if (mevcutUser) {
            return mevcutUser;
        }

        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });
        if (error) throw error;
        
        return data;
    },

    // 2. TELEFON ONAY MOTORU
    telefonuOnayla: async (uid, telNo) => {
        const { error } = await supabase.rpc('me26_telefon_onay', { p_uid: uid, p_tel: telNo });
        if (error) throw error;
    },

    // 3. E-DEVLET BELGE MOTORU (Sadece İnceleme Kuyruğuna Alma)
    belgeyiSirayaAl: async (uid, belgeData) => {
        const { error } = await supabase.rpc('me26_belge_yukle', { 
            p_uid: uid, 
            p_data: belgeData 
        });
        
        if (error) throw error;
    },

    // 4. ŞEHİR (TRİBÜN) GÜNCELLEME MOTORU
    sehirGuncelle: async (uid, secilenSehir) => {
        const { error } = await supabase.rpc('me26_sehir_guncelle', { 
            p_uid: uid, 
            p_sehir: secilenSehir 
        });

        if (error) throw error;
    },

    // 5. STANDART NUMARA ATAMA MOTORU
    standartNumaraAl: async (uid) => {
        const { data, error } = await supabase.rpc('me26_standart_numara_al', { p_uid: uid });
        if (error) throw error;
        
        return data; 
    },

    // 6. YENİ ÖNERGE (ORTAK AKIL) VERİTABANINA YAZMA MOTORU
    onergeGonder: async (uid, baslik, sorun, cozum, hedefKitle, sure) => {
        const { data, error } = await supabase
            .from('onergeler')
            .insert([
                { 
                    yazar_uid: uid, 
                    baslik: baslik, 
                    sorun: sorun, 
                    cozum: cozum, 
                    hedef_kitle: hedefKitle, 
                    sure: parseInt(sure) 
                }
            ]);
            
        if (error) throw error;
        return data;
    },

    // 7. ÖNERGELERİ EKRANA ÇEKME MOTORU
    onergeleriGetir: async () => {
        const { data, error } = await supabase
            .from('onergeler')
            .select('*')
            .order('olusturulma_tarihi', { ascending: false }); 
            
        if (error) throw error;
        return data;
    },

    // 8. DESTEK VERME MOTORU
    destekVer: async (uid, onergeId) => {
        const { error } = await supabase.rpc('me26_destek_ver', { p_onerge_id: onergeId, p_uid: uid });
        
        if (error) {
            // Eğer daha önce destek vermişse (unique constraint hatası) özel bir hata fırlat
            if (error.message.includes('unique constraint') || error.code === '23505') {
                throw new Error('already_supported');
            }
            throw error;
        }
    },

    // 9. CANLI TRİBÜN LİGİ SAYIMI
    tribunLigiGetir: async () => {
        const { data: users, error: userError } = await supabase.from('users').select('id, sehir, mesleki_durum');
        if (userError) throw userError;

        const { data: onergeler, error: onergeError } = await supabase.from('onergeler').select('yazar_uid');
        if (onergeError) throw onergeError;

        const { data: sorular, error: soruError } = await supabase.from('me26_sorular').select('yazar_uid');
        if (soruError) throw soruError;

        const { data: cevaplar, error: cevapError } = await supabase.from('me26_cevaplar').select('yazar_uid');
        if (cevapError) throw cevapError;

        const cityMap = {};
        const userCityMap = {}; 

        users.forEach(u => {
            const city = u.sehir;
            userCityMap[u.id] = city; 

            if (!city || city === 'Belirsiz' || city === 'Seçilmedi') return;
            
            if (!cityMap[city]) {
                cityMap[city] = { city: city, icmimar: 0, ogrenci: 0, onerge: 0, oy: 0, katki: 0, weeklyGrowthPoints: 0, weeklyGrowthPercent: 0 };
            }

            const role = (u.mesleki_durum || '').toLowerCase();
            if (role.includes('öğrenci')) {
                cityMap[city].ogrenci += 1;
            } else {
                cityMap[city].icmimar += 1; 
            }
        });

        if (onergeler) {
            onergeler.forEach(o => {
                const city = userCityMap[o.yazar_uid];
                if (city && cityMap[city]) cityMap[city].onerge += 1;
            });
        }

        const katkilar = [...(sorular || []), ...(cevaplar || [])];
        katkilar.forEach(k => {
            const city = userCityMap[k.yazar_uid];
            if (city && cityMap[city]) cityMap[city].katki += 1;
        });

        return Object.values(cityMap);
    }
};
