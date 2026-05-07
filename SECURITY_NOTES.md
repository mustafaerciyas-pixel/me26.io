# ME26 v0.80 Güvenlik Notları

Bu paket mevcut çalışan arayüzü bozmadan güvenlik ve canlı yayın metinlerini sertleştirir.

## Uygulanan değişiklikler

- Koruma Hattı dosya yükleme alanı canlı güvenlik denetimi tamamlanana kadar pasifleştirildi.
- Koruma Hattı artık yalnızca yazılı bildirim alır; delil/belge bağlantısı link veya açıklama alanına yazılabilir.
- PDF belge alanı “otomatik doğrulama” olarak değil, manuel inceleme kuyruğu olarak konumlandırıldı.
- SMS ekranındaki tarayıcı tabanlı bekleme sınırının gerçek güvenlik limiti olmadığı açıklandı.
- `qa.js` içindeki dinamik butonlarda inline `onclick` kullanımı azaltıldı; data-action + event delegation düzenine geçildi.
- `state.js` için çoklu sekme senkronizasyonu eklendi.
- `stadium.js` için heartbeat / last_seen hazırlığı eklendi.
- Mevcut Firebase/Supabase bağlantı değerleri değiştirilmedi.

## Önemli güvenlik sınırları

- Firebase Web API key ve Supabase anon key frontend’de görünebilir. Bunlar service role/admin secret değildir.
- Gerçek güvenlik için Supabase RLS politikaları zorunludur.
- SMS rate-limit frontend’de tam güvenli sağlanamaz; Firebase/App Check veya backend/Worker tarafı limit gerekir.
- Gerçek dosya yükleme açılmadan önce private Supabase Storage bucket, dosya boyutu/MIME kontrolü, virüs tarama ve admin inceleme akışı kurulmalıdır.
- Belge doğrulama şu an manuel inceleme kuyruğudur; otomatik E-Devlet doğrulaması iddiası kullanılmamalıdır.

## Canlıya çıkmadan önce kontrol

1. Chrome Console kırmızı hata kontrolü.
2. Google giriş / çıkış testi.
3. Önerge gönderme ve destekleme testi.
4. Soru-cevap testi.
5. Koruma hattı yazılı bildirim testi.
6. Supabase RLS politikalarının aktif olduğunun doğrulanması.
