# ME26 v0.80 Canlı Güvenlik + Tasarım Paketi

Bu paket, mevcut çalışan buton/ID/import zincirini bozmadan hazırlanmıştır.

## Değişen ana dosyalar

- `index.html`: Koruma Hattı dosya yükleme alanı pasifleştirildi; PDF başvuru metni manuel inceleme kuyruğu olarak güncellendi; SMS UX limiti notu eklendi; premium canlı gövde sınıfı eklendi.
- `style.css`: Koyu premium/altın sarı canlı yayın kabuğu eklendi.
- `auth.js`: SMS limit açıklamaları ve belge kuyruk dili düzeltildi.
- `koruma.js`: Dosya yükleme pasifken yanlış beklenti oluşmaması için güvenli bilgilendirme eklendi.
- `qa.js`: Inline `onclick` kullanımı azaltıldı; dinamik butonlar `data-qa-action` + event delegation ile çalışır hâle getirildi.
- `state.js`: Çoklu sekme senkronizasyonu eklendi.
- `stadium.js`: Presence heartbeat / last_seen hazırlığı eklendi.

## Değişmeyen kritik çalışma zinciri

- Firebase config ve Supabase anon bağlantıları değiştirilmedi.
- Tablo/RPC isimleri değiştirilmedi.
- `app.js` ana motoru korunmuştur.
- Mevcut buton ID'leri korunmuştur.
- `index.html` sonunda `app.js` ve `qa.js` modül bağlantıları korunmuştur.

## Eklenen not dosyaları

- `SECURITY_NOTES.md`
- `SUPABASE_RLS_POLICIES.sql`
- `CANLI_TEST_LISTESI.md`

## Test

Tüm `.js` dosyaları `node --check` ile syntax kontrolünden geçirilmiştir.
