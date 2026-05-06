/* ==========================================================================
   ME26 AĞI - SUPABASE VERİTABANI KÖPRÜSÜ (supabase.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   KRİTİK NOT:
   - Bu dosyada service_role key ASLA kullanılmaz.
   - Frontend'de yalnızca Supabase anon / publishable key kullanılabilir.
   - Gerçek güvenlik Supabase RLS + RPC fonksiyonlarıyla sağlanmalıdır.
   - VIP numara, oy ve destek gibi işlemler veritabanında benzersiz kilitlenmelidir.
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

// ------------------------------------------------------
// SUPABASE CLIENT
// ------------------------------------------------------
export const supabase = createClient(
    ME26_CONFIG.supabaseUrl,
    ME26_CONFIG.supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const cleanString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const cleanNullableString = (value) => {
    const cleaned = cleanString(value);
    return cleaned.length > 0 ? cleaned : null;
};

const cleanNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanVoteChoice = (value) => {
    const choice = cleanString(value);

    if (!['yes', 'no', 'abstain'].includes(choice)) {
        throw new Error('invalid_vote_choice');
    }

    return choice;
};

const normalizeDbError = (error, fallbackMessage = 'database_error') => {
    if (!error) return new Error(fallbackMessage);

    const code = cleanString(error.code);
    const message = cleanString(error.message).toLowerCase();
    const details = cleanString(error.details).toLowerCase();

    // PostgreSQL unique violation
    if (code === '23505') {
        return new Error('duplicate_record');
    }

    if (
        message.includes('unique constraint') ||
        message.includes('duplicate key') ||
        details.includes('already exists')
    ) {
        return new Error('duplicate_record');
    }

    // RPC tarafında özel hata mesajları dönerse yakala
    if (
        message.includes('already_voted') ||
        message.includes('zaten oy') ||
        message.includes('already voted')
    ) {
        return new Error('already_voted');
    }

    if (
        message.includes('already_supported') ||
        message.includes('zaten destek') ||
        message.includes('already supported')
    ) {
        return new Error('already_supported');
    }

    if (
        message.includes('vip_number_taken') ||
        message.includes('vip numara') ||
        message.includes('number taken')
    ) {
        return new Error('vip_number_taken');
    }

    if (
        message.includes('missing_uid') ||
        message.includes('invalid_vip_number') ||
        message.includes('invalid_vote_power')
    ) {
        return new Error(message);
    }

    return error || new Error(fallbackMessage);
};

const safeRpc = async (rpcName, params = {}) => {
    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
        throw normalizeDbError(error, `${rpcName}_failed`);
    }

    return data;
};

const safeSelect = async (query, fallback = []) => {
    const { data, error } = await query;

    if (error) {
        throw normalizeDbError(error, 'select_failed');
    }

    return data || fallback;
};

const safeMaybeSingle = async (query) => {
    const { data, error } = await query;

    if (error) {
        throw normalizeDbError(error, 'single_select_failed');
    }

    return data || null;
};

// ======================================================
// DB MOTORU
// ======================================================
export const DB = {
    // --------------------------------------------------
    // 1. SİSTEME GİRİŞ
    // Google giriş sonrası kullanıcıyı veritabanında bulur veya oluşturur.
    // --------------------------------------------------
    sistemeGiris: async (gizliPaket) => {
        if (!gizliPaket || !gizliPaket.uid) {
            throw new Error('missing_user_payload');
        }

        const uid = cleanString(gizliPaket.uid);

        if (!uid) {
            throw new Error('missing_uid');
        }

        const mevcutUser = await safeMaybeSingle(
            supabase
                .from('users')
                .select('*')
                .eq('id', uid)
                .maybeSingle()
        );

        if (mevcutUser) {
            return mevcutUser;
        }

        const payload = {
            uid,
            g_isim: cleanString(gizliPaket.g_isim, 'İsimsiz'),
            mail: cleanNullableString(gizliPaket.mail),
            foto: cleanNullableString(gizliPaket.foto),
            m_durum: cleanString(gizliPaket.m_durum, 'Belirsiz'),
            sehir: cleanNullableString(gizliPaket.sehir),
            d_kod: cleanString(gizliPaket.d_kod),
            ref: cleanNullableString(gizliPaket.ref)
        };

        return await safeRpc('me26_sistem_giris', {
            p_payload: payload
        });
    },

    // --------------------------------------------------
    // 2. TELEFON ONAY
    // --------------------------------------------------
    telefonuOnayla: async (uid, telNo) => {
        const temizUid = cleanString(uid);
        const temizTel = cleanString(telNo);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizTel) throw new Error('missing_phone');

        return await safeRpc('me26_telefon_onay', {
            p_uid: temizUid,
            p_tel: temizTel
        });
    },

    // --------------------------------------------------
    // 3. BELGE İNCELEME KUYRUĞU
    // Fiziksel dosya yüklemez; belge başvurusunu inceleme kuyruğuna alır.
    // --------------------------------------------------
    belgeyiSirayaAl: async (uid, belgeData) => {
        const temizUid = cleanString(uid);

        if (!temizUid) throw new Error('missing_uid');

        if (!belgeData || typeof belgeData !== 'object') {
            throw new Error('missing_document_payload');
        }

        const temizBelge = {
            dosya_adi: cleanString(belgeData.dosya_adi).slice(0, 180),
            tur: cleanString(belgeData.tur, 'application/pdf'),
            belge_durumu: cleanString(belgeData.belge_durumu, 'Onay Bekliyor')
        };

        if (!temizBelge.dosya_adi) {
            throw new Error('missing_document_name');
        }

        return await safeRpc('me26_belge_yukle', {
            p_uid: temizUid,
            p_data: temizBelge
        });
    },

    // --------------------------------------------------
    // 4. ŞEHİR / TRİBÜN GÜNCELLEME
    // --------------------------------------------------
    sehirGuncelle: async (uid, secilenSehir) => {
        const temizUid = cleanString(uid);
        const temizSehir = cleanString(secilenSehir);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizSehir) throw new Error('missing_city');

        return await safeRpc('me26_sehir_guncelle', {
            p_uid: temizUid,
            p_sehir: temizSehir
        });
    },

    // --------------------------------------------------
    // 5. STANDART NUMARA ALMA
    // --------------------------------------------------
    standartNumaraAl: async (uid) => {
        const temizUid = cleanString(uid);

        if (!temizUid) throw new Error('missing_uid');

        return await safeRpc('me26_standart_numara_al', {
            p_uid: temizUid
        });
    },

    // --------------------------------------------------
    // 6. VIP NUMARA ALMA
    // vip.js bu fonksiyonu kullanır.
    // Veritabanında me26_vip_numara_al RPC fonksiyonu olmalıdır.
    // Bu RPC aynı numarayı iki kişiye vermeyecek şekilde kilitlemelidir.
    // --------------------------------------------------
    vipNumaraAl: async (uid, vipNumber) => {
        const temizUid = cleanString(uid);
        const temizNo = cleanNumber(vipNumber, 0);

        if (!temizUid) throw new Error('missing_uid');
        if (temizNo <= 0) throw new Error('invalid_vip_number');

        try {
            return await safeRpc('me26_vip_numara_al', {
                p_uid: temizUid,
                p_vip_no: temizNo
            });
        } catch (error) {
            const normalized = normalizeDbError(error, 'vip_claim_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'vip_number_taken'
            ) {
                throw new Error('vip_number_taken');
            }

            throw normalized;
        }
    },

    // --------------------------------------------------
    // 7. ÖNERGE GÖNDERME
    // --------------------------------------------------
    onergeGonder: async (uid, baslik, sorun, cozum, hedefKitle, sure) => {
        const temizUid = cleanString(uid);
        const temizBaslik = cleanString(baslik);
        const temizSorun = cleanString(sorun);
        const temizCozum = cleanString(cozum);
        const temizHedefKitle = cleanString(hedefKitle, 'Herkes');

        if (!temizUid) throw new Error('missing_uid');
        if (temizBaslik.length < 15) throw new Error('title_too_short');
        if (temizBaslik.length > 150) throw new Error('title_too_long');
        if (!temizSorun) throw new Error('missing_problem');
        if (!temizCozum) throw new Error('missing_solution');

        const sureSayisi = Number.parseInt(String(sure), 10);
        const temizSure = Number.isFinite(sureSayisi) ? sureSayisi : 2;

        const yeniOnerge = {
            yazar_uid: temizUid,
            baslik: temizBaslik,
            sorun: temizSorun,
            cozum: temizCozum,
            hedef_kitle: temizHedefKitle,
            sure: temizSure
        };

        const { error } = await supabase
            .from('onergeler')
            .insert([yeniOnerge]);

        if (error) {
            throw normalizeDbError(error, 'proposal_insert_failed');
        }

        return true;
    },

    // --------------------------------------------------
    // 8. ÖNERGELERİ GETİRME
    // --------------------------------------------------
    onergeleriGetir: async () => {
        return await safeSelect(
            supabase
                .from('onergeler')
                .select('*')
                .order('olusturulma_tarihi', { ascending: false }),
            []
        );
    },

    // --------------------------------------------------
    // 9. ÖNERGEYE DESTEK VERME
    // --------------------------------------------------
    destekVer: async (uid, onergeId) => {
        const temizUid = cleanString(uid);
        const temizOnergeId = cleanString(onergeId);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizOnergeId) throw new Error('missing_proposal_id');

        try {
            return await safeRpc('me26_destek_ver', {
                p_onerge_id: temizOnergeId,
                p_uid: temizUid
            });
        } catch (error) {
            const normalized = normalizeDbError(error, 'support_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'already_supported'
            ) {
                throw new Error('already_supported');
            }

            throw normalized;
        }
    },

    // --------------------------------------------------
    // 10. OY KULLANMA
    // --------------------------------------------------
    oyKullan: async (uid, onergeId, kullanilanOy, oyGucu) => {
        const temizUid = cleanString(uid);
        const temizOnergeId = cleanString(onergeId);
        const temizOy = cleanVoteChoice(kullanilanOy);
        const temizOyGucu = cleanNumber(oyGucu, 0);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizOnergeId) throw new Error('missing_proposal_id');
        if (temizOyGucu <= 0) throw new Error('invalid_vote_power');

        const yeniOy = {
            onerge_id: temizOnergeId,
            user_id: temizUid,
            kullanilan_oy: temizOy,
            oy_gucu: temizOyGucu
        };

        const { error } = await supabase
            .from('me26_oylar')
            .insert([yeniOy]);

        if (error) {
            const normalized = normalizeDbError(error, 'vote_insert_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'already_voted'
            ) {
                throw new Error('already_voted');
            }

            throw normalized;
        }

        return true;
    },

    // --------------------------------------------------
    // 11. OY SONUÇLARI
    // --------------------------------------------------
    oySonuclariniGetir: async (onergeId) => {
        const temizOnergeId = cleanString(onergeId);

        if (!temizOnergeId) throw new Error('missing_proposal_id');

        return await safeSelect(
            supabase
                .from('me26_oylar')
                .select('kullanilan_oy, oy_gucu')
                .eq('onerge_id', temizOnergeId),
            []
        );
    },

    // --------------------------------------------------
    // 12. TRİBÜN LİGİ
    // --------------------------------------------------
    tribunLigiGetir: async () => {
        const users = await safeSelect(
            supabase
                .from('users')
                .select('id, sehir, mesleki_durum'),
            []
        );

        const onergeler = await safeSelect(
            supabase
                .from('onergeler')
                .select('yazar_uid'),
            []
        );

        const oylar = await safeSelect(
            supabase
                .from('me26_oylar')
                .select('user_id'),
            []
        );

        const sorular = await safeSelect(
            supabase
                .from('me26_sorular')
                .select('yazar_uid'),
            []
        );

        const cevaplar = await safeSelect(
            supabase
                .from('me26_cevaplar')
                .select('yazar_uid'),
            []
        );

        const cityMap = {};
        const userCityMap = {};

        users.forEach((user) => {
            const city = cleanString(user.sehir);

            userCityMap[user.id] = city;

            if (!city || city === 'Belirsiz' || city === 'Seçilmedi') return;

            if (!cityMap[city]) {
                cityMap[city] = {
                    city,
                    icmimar: 0,
                    ogrenci: 0,
                    onerge: 0,
                    oy: 0,
                    katki: 0,
                    weeklyGrowthPoints: 0,
                    weeklyGrowthPercent: 0
                };
            }

            const role = cleanString(user.mesleki_durum).toLowerCase();

            if (role.includes('öğrenci')) {
                cityMap[city].ogrenci += 1;
            } else {
                cityMap[city].icmimar += 1;
            }
        });

        onergeler.forEach((onerge) => {
            const city = userCityMap[onerge.yazar_uid];

            if (city && cityMap[city]) {
                cityMap[city].onerge += 1;
            }
        });

        oylar.forEach((oy) => {
            const city = userCityMap[oy.user_id];

            if (city && cityMap[city]) {
                cityMap[city].oy += 1;
            }
        });

        const katkilar = [
            ...(sorular || []),
            ...(cevaplar || [])
        ];

        katkilar.forEach((katki) => {
            const city = userCityMap[katki.yazar_uid];

            if (city && cityMap[city]) {
                cityMap[city].katki += 1;
            }
        });

        return Object
            .values(cityMap)
            .sort((a, b) => {
                const scoreA =
                    a.icmimar * 10 +
                    a.ogrenci * 5 +
                    a.onerge * 2 +
                    a.oy * 1 +
                    a.katki * 2;

                const scoreB =
                    b.icmimar * 10 +
                    b.ogrenci * 5 +
                    b.onerge * 2 +
                    b.oy * 1 +
                    b.katki * 2;

                return scoreB - scoreA;
            });
    },

    // --------------------------------------------------
    // 13. KORUMA HATTI BİLDİRİMİ
    // koruma.js bu fonksiyonu kullanır.
    // --------------------------------------------------
    korumaBildir: async (payload) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('missing_koruma_payload');
        }

        const bildirim = {
            bildiren_uid: cleanString(payload.bildiren_uid, 'TR-IA-ZİYARETÇİ'),
            bildirim_turu: cleanString(payload.bildirim_turu),
            sikayet_edilen: cleanString(payload.sikayet_edilen),
            baglanti: cleanNullableString(payload.baglanti),
            aciklama: cleanString(payload.aciklama),
            ad_soyad: cleanNullableString(payload.ad_soyad),
            iletisim: cleanNullableString(payload.iletisim),
            anonim_mi: Boolean(payload.anonim_mi)
        };

        if (!bildirim.bildirim_turu) throw new Error('missing_koruma_type');
        if (!bildirim.sikayet_edilen) throw new Error('missing_koruma_target');
        if (bildirim.aciklama.length < 20) throw new Error('koruma_description_too_short');

        const { error } = await supabase
            .from('me26_koruma_hatti')
            .insert([bildirim]);

        if (error) {
            throw normalizeDbError(error, 'koruma_insert_failed');
        }

        return true;
    }
};
