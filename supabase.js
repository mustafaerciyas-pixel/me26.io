/* ==========================================================================
   ME26 AĞI - SUPABASE VERİTABANI KÖPRÜSÜ (supabase.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   NOT:
   - Bu dosyada service_role key ASLA kullanılmaz.
   - Frontend'de yalnızca Supabase publishable / anon key kullanılabilir.
   - Gerçek güvenlik Supabase RLS + RPC politikalarıyla sağlanmalıdır.
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

    if (error.code === '23505') {
        return new Error('duplicate_record');
    }

    if (
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('unique constraint')
    ) {
        return new Error('duplicate_record');
    }

    return error;
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

// ======================================================
// DB MOTORU
// ======================================================
export const DB = {
    // --------------------------------------------------
    // 1. SİSTEME GİRİŞ
    // --------------------------------------------------
    sistemeGiris: async (gizliPaket) => {
        if (!gizliPaket || !gizliPaket.uid) {
            throw new Error('missing_user_payload');
        }

        const uid = cleanString(gizliPaket.uid);

        const { data: mevcutUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        if (selectError) {
            throw normalizeDbError(selectError, 'user_lookup_failed');
        }

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
    // --------------------------------------------------
    belgeyiSirayaAl: async (uid, belgeData) => {
        const temizUid = cleanString(uid);

        if (!temizUid) throw new Error('missing_uid');
        if (!belgeData || typeof belgeData !== 'object') {
            throw new Error('missing_document_payload');
        }

        const temizBelge = {
            dosya_adi: cleanString(belgeData.dosya_adi),
            tur: cleanString(belgeData.tur, 'application/pdf'),
            belge_durumu: cleanString(belgeData.belge_durumu, 'Onay Bekliyor')
        };

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
    // 6. ÖNERGE GÖNDERME
    // --------------------------------------------------
    onergeGonder: async (uid, baslik, sorun, cozum, hedefKitle, sure) => {
        const temizUid = cleanString(uid);
        const temizBaslik = cleanString(baslik);
        const temizSorun = cleanString(sorun);
        const temizCozum = cleanString(cozum);
        const temizHedefKitle = cleanString(hedefKitle, 'Herkes');

        if (!temizUid) throw new Error('missing_uid');
        if (temizBaslik.length < 15) throw new Error('title_too_short');
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
    // 7. ÖNERGELERİ GETİRME
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
    // 8. ÖNERGEYE DESTEK VERME
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
            if (error.message === 'duplicate_record') {
                throw new Error('already_supported');
            }

            throw error;
        }
    },

    // --------------------------------------------------
    // 9. OY KULLANMA
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

            if (normalized.message === 'duplicate_record') {
                throw new Error('already_voted');
            }

            throw normalized;
        }

        return true;
    },

    // --------------------------------------------------
    // 10. OY SONUÇLARI
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
    // 11. TRİBÜN LİGİ
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
                    a.icmimar * 3 +
                    a.ogrenci * 2 +
                    a.onerge * 5 +
                    a.katki * 2;

                const scoreB =
                    b.icmimar * 3 +
                    b.ogrenci * 2 +
                    b.onerge * 5 +
                    b.katki * 2;

                return scoreB - scoreA;
            });
    },

    // --------------------------------------------------
    // 12. KORUMA HATTI BİLDİRİMİ
    // Şimdilik koruma.js doğrudan supabase kullanıyor.
    // Sonraki adımda koruma.js'i buraya bağlayacağız.
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
