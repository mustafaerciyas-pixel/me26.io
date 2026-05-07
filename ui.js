/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   Hibrit Vitrin + Otomatik Bouncer + Ortak Kürsü Modeli + Tribün Ligi
   Canlı Yayın (Production) Sürümü
   ========================================================================== */

import { STATE } from './state.js';

export const UI = {
    // 1. ANA EKRAN GEÇİŞİ (DIŞ KAPI <-> İÇ PANEL)
    showView: (viewId) => {
        const landing = document.getElementById('landing-view');
        const saas = document.getElementById('saas-view');
        
        if (landing) landing.classList.add('hidden');
        if (saas) { saas.classList.add('hidden'); saas.classList.remove('flex'); }

        if (viewId === 'landing') {
            if (landing) landing.classList.remove('hidden');
        } else if (viewId === 'saas') {
            if (saas) {
                saas.classList.remove('hidden');
                saas.classList.add('flex');
            }
        }
    },

    // 2. SAAS SEKMELERİ ARASI GEÇİŞ
    switchSaasTab: (targetId) => {
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('block');
        });
        
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }

        document.querySelectorAll('.nav-menu-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
            btn.classList.add('text-gray-400');
        });

        document.querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`).forEach(btn => {
            btn.classList.add('active', 'bg-slate-800', 'text-white');
            btn.classList.remove('text-gray-400');
        });
    },

    // 3. PENCERELER (MODALLAR)
    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // ==========================================
    // ORTAK KÜRSÜ MODAL YÖNETİMİ
    // ==========================================
    openKursuModal: () => {
        // GÜVENLİK DUVARI: Bouncer onaylamazsa modal hiç açılmaz
        if (!UI.triggerVerificationGate()) return;
        
        UI.switchKursuTab('onerge'); // Varsayılan olarak Önerge sekmesi açılsın
        UI.openModal('ortak-kursu-modal');
    },

    switchKursuTab: (tab) => {
        const btnOnerge = document.getElementById('tab-btn-onerge');
        const btnSoru = document.getElementById('tab-btn-soru');
        const fieldsOnerge = document.getElementById('kursu-onerge-fields');
        const fieldsSoru = document.getElementById('kursu-soru-fields');
        const btnSubmit = document.getElementById('btn-submit-kursu');
        const durationInput = document.getElementById('input-kursu-duration');

        // Modu state'e kaydet (Gönderirken app.js'e lazım olacak)
        STATE.aktifKursuModu = tab; 

        if (tab === 'onerge') {
            btnOnerge.className = "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition bg-slate-800 text-white shadow-md";
            btnSoru.className = "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition text-gray-500 hover:text-white bg-transparent";
            
            fieldsOnerge.classList.remove('hidden');
            fieldsOnerge.classList.add('block');
            fieldsSoru.classList.add('hidden');
            fieldsSoru.classList.remove('block');
            
            if(durationInput) durationInput.parentElement.classList.remove('hidden'); // Süreyi göster
            btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> Önergeyi Gündeme Gönder';
        } else {
            btnSoru.className = "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition bg-slate-800 text-white shadow-md";
            btnOnerge.className = "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition text-gray-500 hover:text-white bg-transparent";
            
            fieldsSoru.classList.remove('hidden');
            fieldsSoru.classList.add('block');
            fieldsOnerge.classList.add('hidden');
            fieldsOnerge.classList.remove('block');
            
            if(durationInput) durationInput.parentElement.classList.add('hidden'); // Süreyi gizle
            btnSubmit.innerHTML = '<i class="fas fa-comment-dots"></i> Soruyu Ortak Akla Gönder';
        }
    },

    // 4. BİLDİRİM (TOAST) MESAJLARI
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const isSuccess = type === 'success';
        const isInfo = type === 'info';
        
        let bgColor = isSuccess ? 'bg-green-900/90 text-green-400 border-green-700' : 
                      isInfo ? 'bg-blue-900/90 text-blue-400 border-blue-700' : 
                      'bg-red-900/90 text-red-400 border-red-700';
                      
        let icon = isSuccess ? '✅' : isInfo ? 'ℹ️' : '❌';

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-xs font-bold uppercase tracking-widest transform transition-all duration-500 translate-y-10 opacity-0 border ${bgColor}`;
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // ==========================================
    // OTOMATİK BOUNCER (GÜVENLİK KAPISI)
    // ==========================================
    triggerVerificationGate: (silent = false) => {
        if (!STATE.isLoggedIn()) {
            if (!silent) UI.showToast('İşlem yapabilmek için sisteme giriş yapmalısınız.', 'error');
            return false;
        }

        const currentPower = parseFloat((STATE.user.votePower || "0").replace('x', ''));
        const isVerified = STATE.user.authStage === "pdf_verified" || currentPower >= 1.0;

        if (isVerified) return true;

        if (!silent) {
            if (STATE.user.authStage === "document_pending") {
                UI.showToast("Mesleki belge başvurunuz inceleme kuyruğunda. Onay sonrası tam erişim açılacak.", "info");
            } else if (STATE.user.hasPhone) {
                UI.showToast("Telefon doğrulandı. Tam erişim için mesleki belgenizi yüklemelisin.", "info");
            } else {
                UI.showToast("Bu alan doğrulanmış İçmimarlık Mezunları ve İçmimarlık Öğrencileri içindir. Sicilini tamamlamalısın.", "error");
            }
            UI.switchSaasTab("view-profil"); // Sicil & Ayarlar paneline fırlat
        }
        return false;
    },

    // 5. AKILLI PROFİL MOTORU
    renderProfile: () => {
        if (!STATE.isLoggedIn()) return;

        const user = STATE.user;
        const setEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

        // --- TEMEL BİLGİLER ---
        const isCitySelected = user.city && user.city !== 'Seçilmedi' && user.city !== 'Belirsiz';
        
        // Rol text kontrolü
        let displayRole = 'Kimlik Bekleniyor';
        if (user.role && user.role !== 'Belirsiz') {
            displayRole = user.role.toLowerCase().includes('öğrenci') ? 'İçmimarlık Öğrencisi' : 'İçmimarlık Mezunu';
        }
        
        // 1.0x ve 0.0x yerine Tam / Sınırlı Erişim
        const displayPower = user.authStage === 'pdf_verified' ? 'Tam' : 'Sınırlı';
        
        setEl('ui-user-city', isCitySelected ? user.city : 'TRİBÜN SEÇİLMEDİ');
        setEl('ui-user-role', displayRole);
        setEl('ui-vote-power', displayPower);
        setEl('sidebar-user-role', displayRole);
        setEl('sidebar-vote-power', displayPower);

        let userIdText = 'TR-IA-BEKLEYEN';
        const numaraAlinmisMi = user.userNo && user.userNo !== 'BEKLEYEN';
        if (numaraAlinmisMi) userIdText = `TR-IA-${user.userNo}`;
        
        setEl('ui-user-id', userIdText);
        setEl('sidebar-user-id', userIdText);
        setEl('mobile-user-id', userIdText);

        const idBadge = document.getElementById('ui-role-badge');
        if (numaraAlinmisMi) {
            if (user.isVip) {
                if (idBadge) { idBadge.textContent = 'VIP KURUCU'; idBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos'; }
            } else {
                if (idBadge) { idBadge.textContent = 'ASİL KURUCU'; idBadge.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
            }
        } else {
            if (idBadge) { idBadge.textContent = 'Aday Kurucu'; idBadge.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
        }

        // ==========================================
        // SİSTEM DURUMU (LOBİ KUTUSU) DİNAMİK GÜNCELLEME
        // ==========================================
        const sistemDurumuEl = document.getElementById('ui-sistem-durumu');
        if (sistemDurumuEl) {
            const containerBox = sistemDurumuEl.parentElement;
            const titleBox = sistemDurumuEl.previousElementSibling;

            if (user.authStage === 'pdf_verified') {
                sistemDurumuEl.innerHTML = 'Tebrikler! Mesleki belgeni inceledik ve onayladık. Artık sistemde <strong class="text-white">Tam Erişim</strong> hakkına sahipsin. Otonom sandıklarda oy kullanabilir ve kendi projelerini meclise sunabilirsin.';
                containerBox.className = "bg-green-900/20 border border-green-500/30 p-6 rounded-2xl"; 
                titleBox.className = "text-green-400 text-xs font-black tracking-widest uppercase mb-3";
                titleBox.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Sistem Durumu: Tam Erişim';
            } else if (user.authStage === 'document_pending') {
                sistemDurumuEl.innerHTML = 'Mesleki belgeni aldık, şu an <strong class="text-white">inceleme kuyruğunda</strong> güvenle bekliyor. Kontroller bittiğinde ve belgen onaylandığında meclisteki tüm kapılar sana açılacak (Tam Erişim).';
                containerBox.className = "bg-yellow-900/20 border border-yellow-500/30 p-6 rounded-2xl";
                titleBox.className = "text-yellow-400 text-xs font-black tracking-widest uppercase mb-3";
                titleBox.innerHTML = '<i class="fas fa-hourglass-half mr-2"></i> Sistem Durumu: İncelemede';
            } else if (user.hasPhone) {
                sistemDurumuEl.innerHTML = 'Harika, telefon numaranı doğruladın! Şimdi son bir adım kaldı: Oylamalara katılmak için <strong class="text-white">mesleki belgeni yüklemelisin.</strong> Belgen onaylandığında Tam Erişim kazanacaksın.';
                containerBox.className = "bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl";
                titleBox.className = "text-blue-400 text-xs font-black tracking-widest uppercase mb-3";
                titleBox.innerHTML = '<i class="fas fa-info-circle mr-2"></i> Sistem Durumu: Eksik Yetki';
            } else {
                sistemDurumuEl.innerHTML = 'Sistemimize hoş geldin! Şu an meclisi sadece izleyebiliyorsun. İçerideki oylamalara katılmak ve kendi fikirlerini sunmak için gerçek bir meslektaşımız olduğunu doğrulamamız gerekiyor. Lütfen profilinden <strong class="text-white">mesleki belgeni incelemeye gönder.</strong> Belgen onaylandığında, sistemdeki tüm kapılar sana açılacak (Tam Erişim).';
                containerBox.className = "bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl";
                titleBox.className = "text-gray-400 text-xs font-black tracking-widest uppercase mb-3";
                titleBox.innerHTML = '<i class="fas fa-info-circle mr-2"></i> Sistem Durumu: Kayıtlı İzleyici';
            }
        }

        // --- SAĞ PANEL (AĞI BÜYÜT & VIP) MANTIĞI ---
        const inviteCount = user.inviteCount || 0;
        setEl('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);
        const progressBar = document.getElementById('ui-vip-progress-bar');
        if (progressBar) progressBar.style.width = `${Math.min((inviteCount / 3) * 100, 100)}%`;

        const btnVipModal = document.getElementById('btn-open-vip-modal');
        const btnStandartNum = document.getElementById('btn-standart-numara');
        const vipStatus = document.getElementById('ui-vip-status');

        if (numaraAlinmisMi) {
            if (btnVipModal) btnVipModal.classList.add('hidden');
            if (btnStandartNum) btnStandartNum.classList.add('hidden');
            if (vipStatus) {
                vipStatus.textContent = 'SİSTEM ELÇİSİ';
                vipStatus.className = 'text-[9px] text-slate-900 font-black bg-kaos px-2 py-1 rounded border border-kaos shadow-kaos';
            }
        } else {
            if (btnVipModal) btnVipModal.classList.remove('hidden');
            if (btnStandartNum) btnStandartNum.classList.remove('hidden');
            if (vipStatus) {
                if (inviteCount >= 3) {
                    vipStatus.textContent = 'KİLİT AÇILDI';
                    vipStatus.className = 'text-[9px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-700';
                } else {
                    vipStatus.textContent = 'KİLİTLİ';
                    vipStatus.className = 'text-[9px] text-gray-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700';
                }
            }
        }

        // --- SOL PANEL (GÖREVLER VE TERFİ) MANTIĞI ---
        const btnPhone = document.getElementById('btn-open-phone-modal');
        const btnPdf = document.getElementById('btn-open-pdf-modal');
        const taskContainer = btnPhone ? btnPhone.parentElement : null;

        document.querySelectorAll('.dynamic-task-badge').forEach(el => el.remove());

        const addBadge = (html, extraClass = '') => {
            if (!taskContainer) return;
            const badge = document.createElement('div');
            badge.className = `dynamic-task-badge w-full py-3 rounded-lg text-[10px] md:text-xs text-center uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-2 border ${extraClass}`;
            badge.innerHTML = html;
            taskContainer.insertBefore(badge, taskContainer.firstChild);
        };

        if (user.hasPhone) {
            if (btnPhone) btnPhone.classList.add('hidden');
            addBadge('<span>✅</span> TELEFON DOĞRULANDI (BOT KONTROLÜ)', 'bg-green-900/20 border-green-700/50 text-green-400');
        } else {
            if (btnPhone) btnPhone.classList.remove('hidden');
        }

        if (user.authStage === 'pdf_verified') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('<span>🎓</span> MESLEKİ BELGE ONAYLI (TAM ERİŞİM)', 'bg-indigo-900/20 border-indigo-700/50 text-indigo-400');
            
            if (user.role && user.role.toLowerCase().includes('öğrenci')) {
                const terfiBtn = document.createElement('button');
                terfiBtn.className = 'dynamic-task-badge w-full bg-kaos text-slate-900 hover:opacity-90 font-black py-3 rounded-lg text-[11px] uppercase tracking-widest transition shadow-md flex items-center justify-center gap-2 mt-2';
                terfiBtn.innerHTML = '<i class="fas fa-graduation-cap text-lg"></i> Mezun Oldun Mu? Unvanını Güncelle';
                terfiBtn.onclick = () => UI.openModal('pdf-modal');
                if (taskContainer) taskContainer.appendChild(terfiBtn);
            }

        } else if (user.authStage === 'document_pending') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('<span>⏳</span> İNCELEME KUYRUĞUNDA BEKLİYOR', 'bg-yellow-900/20 border-yellow-700/50 text-yellow-500');
        } else {
            if (btnPdf) btnPdf.classList.remove('hidden');
        }

        const citySelectors = document.querySelectorAll('#ui-city-selector-container');
        citySelectors.forEach(el => {
            if (!isCitySelected) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    },

    // 6. ÖNERGELERİ EKRANA BASMA (BUZLU CAM)
    renderProposals: (onergeler) => {
        const meclisContainer = document.getElementById('proposals-container');
        const gundemContainer = document.getElementById('gundem-container'); 

        if (meclisContainer) meclisContainer.innerHTML = ''; 
        if (gundemContainer) gundemContainer.innerHTML = '';

        if (!onergeler || onergeler.length === 0) {
            if (meclisContainer) meclisContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Bekleyen önerge yok.</p>';
            if (gundemContainer) gundemContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Sırada önerge yok.</p>';
            return;
        }

        const isAuthorized = UI.triggerVerificationGate(true);

        onergeler.forEach(onerge => {
            const isKotaDoldu = (onerge.destek_sayisi || 0) >= 50;
            const container = isKotaDoldu ? gundemContainer : meclisContainer;
            if(!container) return;

            const yuzde = isAuthorized ? Math.min(((onerge.destek_sayisi || 0) / 50) * 100, 100) : 0;
            const barHTML = isAuthorized ? `<div class="absolute left-0 bottom-0 h-1 ${isKotaDoldu ? 'bg-green-500' : 'bg-kaos'}" style="width: ${yuzde}%"></div>` : '';
            
            const blurClass = isAuthorized ? '' : 'blur-sm opacity-50 select-none pointer-events-none';
            const statText = isAuthorized ? `✅ ${onerge.destek_sayisi || 0}/50` : `🔒 GİZLİ`;
            const overlay = isAuthorized ? '' : `
                <div class="absolute inset-0 z-20 flex items-center justify-center cursor-pointer rounded-2xl" onclick="UI.triggerVerificationGate()">
                    <div class="bg-black/80 px-4 py-2 rounded-full border border-slate-600 shadow-xl flex items-center gap-2">
                        <i class="fas fa-lock text-kaos"></i> <span class="text-[10px] font-black text-white uppercase tracking-widest">KİLİDİ AÇ</span>
                    </div>
                </div>
            `;

            const div = document.createElement('div');
            div.className = 'bg-black/40 border border-slate-600 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg mb-3 group';
            
            div.innerHTML = `
                ${barHTML}
                ${overlay}
                <div class="flex-grow z-10 w-full pr-4 relative">
                    <h4 class="text-base font-black text-white mb-2 leading-tight">${onerge.baslik}</h4>
                    ${!isKotaDoldu ? `<p class="text-xs text-gray-400 line-clamp-2 ${blurClass}">${onerge.sorun}</p>` : ''}
                </div>
                <div class="flex flex-col md:items-end w-full md:w-auto shrink-0 z-10 gap-2 relative">
                    <div class="text-center md:text-right bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 w-full">
                        <div class="text-sm font-black ${isKotaDoldu ? 'text-green-400' : 'text-kaos'} ${blurClass}">${statText}</div>
                    </div>
                    ${!isKotaDoldu ? `<button onclick="${isAuthorized ? '' : 'return UI.triggerVerificationGate()'}" data-id="${onerge.id}" class="btn-destekle w-full ${isAuthorized ? 'bg-slate-800 border-slate-500 text-white hover:bg-slate-700' : 'bg-black/50 border-slate-700 text-gray-500 pointer-events-none'} border px-4 py-2 rounded-xl font-black text-[11px] transition uppercase flex justify-center items-center gap-2"><i class="fas ${isAuthorized ? 'fa-arrow-up text-kaos' : 'fa-lock'}"></i> DESTEKLE</button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });
    },

    // ==========================================
    // 7. TRİBÜN LİGİ (LEADERBOARD) MOTORU
    // ==========================================
    renderTribunLigi: (cityDataArray) => {
        if (!cityDataArray) return;

        // KULLANICI ŞEHRİNİ LİSTEYE OTOMATİK EKLEME (Tüm Şehirler Mantığı)
        const userCity = STATE.user?.city;
        const validCity = userCity && userCity !== 'Belirsiz' && userCity !== 'Seçilmedi';

        // Eğer kullanıcının şehri dizide yoksa, 0 puanla anında listeye ekle
        if (validCity && !cityDataArray.find(c => c.city === userCity)) {
            cityDataArray.push({
                city: userCity,
                icmimar: 0,
                ogrenci: 0,
                onerge: 0,
                oy: 0,
                katki: 0,
                weeklyGrowthPoints: 0,
                weeklyGrowthPercent: 0
            });
        }

        if (cityDataArray.length === 0) return;

        // Puan Hesaplama Formülü
        const calculateCityPower = (city) => {
            return (city.icmimar * 10) + (city.ogrenci * 5) + (city.onerge * 2) + (city.oy * 1) + (city.katki * 2);
        };

        // Verileri güç puanına göre hesapla ve sırala
        const processedData = cityDataArray.map(c => ({
            ...c,
            power: calculateCityPower(c)
        })).sort((a, b) => b.power - a.power);

        // --- 1. ZİRVE KARTLARI ---
        const championsContainer = document.getElementById('tribun-champions');
        if (championsContainer) {
            const genelLider = processedData[0];
            const enAktif = [...processedData].sort((a, b) => (b.onerge + b.oy + b.katki) - (a.onerge + a.oy + a.katki))[0];
            const ogrenciLideri = [...processedData].sort((a, b) => b.ogrenci - a.ogrenci)[0];
            
            // Haftanın Yükseleni (Minimum 50 Puan şartı)
            const eligibleForGrowth = processedData.filter(c => c.weeklyGrowthPoints >= 50);
            const enHizli = eligibleForGrowth.length > 0 
                            ? eligibleForGrowth.sort((a, b) => b.weeklyGrowthPercent - a.weeklyGrowthPercent)[0] 
                            : processedData[0]; // fallback

            championsContainer.innerHTML = `
                <div class="bg-black/50 border border-slate-700 p-4 rounded-xl text-center relative overflow-hidden group">
                    <div class="text-2xl mb-1 drop-shadow-md">👑</div>
                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Genel Lider</div>
                    <div class="text-sm font-black text-kaos uppercase tracking-widest truncate">${genelLider.city}</div>
                </div>
                <div class="bg-black/50 border border-slate-700 p-4 rounded-xl text-center relative overflow-hidden group">
                    <div class="text-2xl mb-1 drop-shadow-md">🔥</div>
                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">En Aktif Tribün</div>
                    <div class="text-sm font-black text-red-400 uppercase tracking-widest truncate">${enAktif.city}</div>
                </div>
                <div class="bg-black/50 border border-slate-700 p-4 rounded-xl text-center relative overflow-hidden group">
                    <div class="text-2xl mb-1 drop-shadow-md">🎓</div>
                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">İçmimarlık Öğrencisi Lideri</div>
                    <div class="text-sm font-black text-blue-400 uppercase tracking-widest truncate">${ogrenciLideri.city}</div>
                </div>
                <div class="bg-black/50 border border-slate-700 p-4 rounded-xl text-center relative overflow-hidden group">
                    <div class="text-2xl mb-1 drop-shadow-md">⚡</div>
                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Haftanın Yükseleni</div>
                    <div class="text-sm font-black text-green-400 uppercase tracking-widest truncate">${enHizli.city}</div>
                </div>
            `;
        }

        // --- 2. SENİN TRİBÜNÜN KARTI (Dinamik Motivasyon) ---
        const userCard = document.getElementById('tribun-user-card');
        
        if (userCard) {
            if (!validCity) {
                userCard.innerHTML = `<p class="text-xs font-bold text-gray-300 uppercase tracking-widest">📍 Tribün seçimi yapılmadı. Şehrini seçerek Liyakat Ligi’ne katıl.</p>`;
            } else {
                // Artık userCityIndex'in bulunacağından eminiz (yukarıda ekledik)
                const userCityIndex = processedData.findIndex(c => c.city === userCity);
                
                if (userCityIndex !== -1) {
                    const myCityData = processedData[userCityIndex];
                    const rank = userCityIndex + 1;
                    let motivasyonMesaji = "";

                    if (rank === 1) {
                        motivasyonMesaji = `<span class="text-green-400">Şehrin zirvede. Farkı açmak için tribününü büyüt.</span>`;
                    } else {
                        const ustSehir = processedData[userCityIndex - 1];
                        const puanFarki = ustSehir.power - myCityData.power;
                        motivasyonMesaji = `<span class="text-yellow-400">Üst sıradaki ${ustSehir.city}’i geçmek için ${puanFarki > 0 ? puanFarki : 1} puan lazım.</span>`;
                    }

                    userCard.innerHTML = `
                        <div class="text-sm font-black text-white uppercase tracking-widest mb-1">
                            Senin Tribünün: <span class="text-kaos">${myCityData.city}</span> · ${rank}. Sıra · ${myCityData.power.toLocaleString()} Puan
                        </div>
                        <div class="text-[10px] font-bold tracking-widest uppercase mt-2">${motivasyonMesaji}</div>
                    `;
                }
            }
        }

        // --- 3. ANA TABLOYU DOLDUR ---
        const tableBody = document.getElementById('tribun-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
            processedData.forEach((city, index) => {
                const rank = index + 1;
                let rankDisplay = `<span class="text-gray-400 font-black">${rank}</span>`;
                if (rank === 1) rankDisplay = `<span class="text-xl" title="Şampiyon">👑</span>`;
                else if (rank === 2) rankDisplay = `<span class="text-lg" title="İkinci">🥈</span>`;
                else if (rank === 3) rankDisplay = `<span class="text-lg" title="Üçüncü">🥉</span>`;

                const isCurrentUserCity = (userCity === city.city);
                const rowClass = isCurrentUserCity ? 'bg-kaos/10 border-b border-kaos/30' : 'border-b border-slate-800 hover:bg-slate-800/50 transition';

                const tr = document.createElement('tr');
                tr.className = rowClass;
                tr.innerHTML = `
                    <td class="p-3 text-center align-middle">${rankDisplay}</td>
                    <td class="p-3 font-black text-white uppercase tracking-widest ${isCurrentUserCity ? 'text-kaos' : ''}">${city.city}</td>
                    <td class="p-3 font-mono font-black text-kaos text-base">${city.power.toLocaleString()}</td>
                    <td class="p-3 text-center text-gray-300 font-mono">${city.icmimar.toLocaleString()}</td>
                    <td class="p-3 text-center text-gray-300 font-mono">${city.ogrenci.toLocaleString()}</td>
                    <td class="p-3 text-center text-gray-400 font-mono">${city.onerge.toLocaleString()}</td>
                    <td class="p-3 text-center text-gray-400 font-mono">${city.oy.toLocaleString()}</td>
                    <td class="p-3 text-center text-gray-400 font-mono">${city.katki.toLocaleString()}</td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // --- 4. VİRAL WHATSAPP BUTONU ---
        const btnViral = document.getElementById('btn-tribun-whatsapp');
        if (btnViral) {
            if (!validCity) {
                btnViral.innerHTML = '<i class="fas fa-map-marker-alt"></i> 📍 ÖNCE ŞEHRİNİ SEÇ';
                btnViral.className = "relative z-10 w-full md:w-auto px-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black py-4 rounded-xl uppercase tracking-widest shadow-md transition flex items-center justify-center gap-2 mx-auto";
                btnViral.onclick = () => UI.switchSaasTab('view-profil');
            } else {
                btnViral.innerHTML = `<i class="fab fa-whatsapp text-xl"></i> 📢 ${userCity} TRİBÜNÜNÜ ŞAMPİYON YAP`;
                btnViral.className = "relative z-10 w-full md:w-auto px-8 bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl uppercase tracking-widest shadow-md transition flex items-center justify-center gap-2 mx-auto";
                btnViral.onclick = () => {
                    const msg = `ME26 Liyakat Ligi başladı. ${userCity} Tribünü'nü zirveye taşımak için katıl, kimliğini doğrula ve şehrinin gücüne puan kazandır: https://me26.org`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                };
            }
        }
    }
};
