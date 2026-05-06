/* ========================================================================== 
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Landing / SaaS ekran geçişleri
   - Modal yönetimi
   - Profil ve erişim durumu yazıları
   - Önerge / gündem kartları
   - Tribün Ligi görünümü
   - XSS riskini azaltmak için kullanıcı içeriklerini ekrana güvenli basmak
   ========================================================================== */

import { STATE } from './state.js';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const escapeHtml = (value) => {
    return cleanText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const truncate = (value, limit = 180) => {
    const text = cleanText(value);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}...`;
};

const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
};

const isCitySelected = (city) => {
    return Boolean(city && city !== 'Belirsiz' && city !== 'Seçilmedi' && city !== 'TRİBÜN SEÇİLMEDİ');
};

const getUser = () => {
    if (typeof STATE.getUser === 'function') return STATE.getUser();
    return STATE.user || {};
};

const getDigitalId = (user) => {
    if (!user) return 'TR-IA-BEKLEYEN';
    if (user.userNo && user.userNo !== 'BEKLEYEN') return `TR-IA-${user.userNo}`;
    return 'TR-IA-BEKLEYEN';
};

const getDisplayRole = (user) => {
    const role = cleanText(user?.role, 'Belirsiz');

    if (!role || role === 'Belirsiz') return 'Kimlik Bekleniyor';
    if (role.toLowerCase().includes('öğrenci')) return 'İçmimarlık Öğrencisi';

    return 'İçmimarlık Mezunu';
};

const getAccessLabel = (user) => {
    return user?.authStage === 'pdf_verified' ? 'Tam' : 'Sınırlı';
};

const getVotePowerNumber = (user) => {
    const raw = user?.votePower || '0';
    const parsed = parseFloat(String(raw).replace('x', ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const getAudienceAuth = (hedefKitle) => {
    const target = cleanText(hedefKitle).toLowerCase();

    if (target.includes('öğrenci')) return 'ogrenci';
    if (target.includes('mezun') || target.includes('içmimar') || target.includes('icmimar')) return 'icmimar';

    return 'herkes';
};

const buildInviteLink = (user) => {
    const code = cleanText(user?.davetKodu) || getDigitalId(user);
    return `https://me26.io/katil?ref=${encodeURIComponent(code)}`;
};

const goToProfile = () => {
    UI.switchSaasTab('view-profil');
};

const createEmptyState = (message) => {
    const div = document.createElement('div');
    div.className = 'text-center py-10 border border-dashed border-slate-700 rounded-2xl text-gray-500 text-xs md:text-sm font-bold tracking-widest uppercase bg-black/20';
    div.textContent = message;
    return div;
};

// ======================================================
// UI MOTORU
// ======================================================
export const UI = {
    // --------------------------------------------------
    // 1. ANA EKRAN GEÇİŞİ
    // --------------------------------------------------
    showView: (viewId) => {
        const landing = $('landing-view');
        const saas = $('saas-view');

        if (landing) landing.classList.add('hidden');

        if (saas) {
            saas.classList.add('hidden');
            saas.classList.remove('flex');
        }

        if (viewId === 'landing') {
            if (landing) landing.classList.remove('hidden');
            document.body.classList.remove('overflow-hidden');
            return;
        }

        if (viewId === 'saas') {
            if (saas) {
                saas.classList.remove('hidden');
                saas.classList.add('flex');
            }
        }
    },

    // --------------------------------------------------
    // 2. SAAS SEKMELERİ ARASI GEÇİŞ
    // --------------------------------------------------
    switchSaasTab: (targetId) => {
        document.querySelectorAll('.view-section').forEach((section) => {
            section.classList.add('hidden');
            section.classList.remove('block');
        });

        const target = $(targetId);

        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }

        document.querySelectorAll('.nav-menu-btn').forEach((btn) => {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
            btn.classList.add('text-gray-400');
        });

        document.querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`).forEach((btn) => {
            btn.classList.add('active', 'bg-slate-800', 'text-white');
            btn.classList.remove('text-gray-400');
        });

        if (targetId === 'view-profil') {
            UI.renderProfile();
        }

        if (targetId === 'view-kursu' && typeof window.qaSorulariGetir === 'function') {
            window.qaSorulariGetir();
        }

        const scrollParent = document.querySelector('#saas-view main');
        if (scrollParent) scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // --------------------------------------------------
    // 3. MODAL YÖNETİMİ
    // --------------------------------------------------
    openModal: (modalId) => {
        const modal = $(modalId);

        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.setAttribute('aria-hidden', 'false');
    },

    closeModal: (modalId) => {
        const modal = $(modalId);

        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.setAttribute('aria-hidden', 'true');
    },

    openKursuModal: () => {
        if (!UI.triggerVerificationGate()) return;

        UI.switchKursuTab('onerge');
        UI.openModal('ortak-kursu-modal');
    },

    switchKursuTab: (tab) => {
        const btnOnerge = $('tab-btn-onerge');
        const btnSoru = $('tab-btn-soru');
        const fieldsOnerge = $('kursu-onerge-fields');
        const fieldsSoru = $('kursu-soru-fields');
        const btnSubmit = $('btn-submit-kursu');
        const durationInput = $('input-kursu-duration');

        STATE.aktifKursuModu = tab;

        const activeClass = 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition bg-slate-800 text-white shadow-md';
        const passiveClass = 'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition text-gray-500 hover:text-white bg-transparent';

        if (tab === 'soru') {
            if (btnSoru) btnSoru.className = activeClass;
            if (btnOnerge) btnOnerge.className = passiveClass;

            if (fieldsSoru) {
                fieldsSoru.classList.remove('hidden');
                fieldsSoru.classList.add('block');
            }

            if (fieldsOnerge) {
                fieldsOnerge.classList.add('hidden');
                fieldsOnerge.classList.remove('block');
            }

            if (durationInput?.parentElement) durationInput.parentElement.classList.add('hidden');
            if (btnSubmit) btnSubmit.innerHTML = 'SORUYU ORTAK AKLA GÖNDER';

            return;
        }

        if (btnOnerge) btnOnerge.className = activeClass;
        if (btnSoru) btnSoru.className = passiveClass;

        if (fieldsOnerge) {
            fieldsOnerge.classList.remove('hidden');
            fieldsOnerge.classList.add('block');
        }

        if (fieldsSoru) {
            fieldsSoru.classList.add('hidden');
            fieldsSoru.classList.remove('block');
        }

        if (durationInput?.parentElement) durationInput.parentElement.classList.remove('hidden');
        if (btnSubmit) btnSubmit.innerHTML = 'ÖNERGEYİ GÜNDEME GÖNDER';
    },

    // --------------------------------------------------
    // 4. TOAST BİLDİRİMLERİ
    // --------------------------------------------------
    showToast: (message, type = 'success') => {
        const container = $('toast-container');
        if (!container) return;

        const safeMessage = escapeHtml(message);
        const toast = document.createElement('div');

        const variants = {
            success: {
                icon: '✅',
                cls: 'bg-green-900/90 text-green-300 border-green-700'
            },
            info: {
                icon: 'ℹ️',
                cls: 'bg-blue-900/90 text-blue-300 border-blue-700'
            },
            error: {
                icon: '❌',
                cls: 'bg-red-900/90 text-red-300 border-red-700'
            },
            warning: {
                icon: '⚠️',
                cls: 'bg-yellow-900/90 text-yellow-300 border-yellow-700'
            }
        };

        const selected = variants[type] || variants.success;

        toast.className = `flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-[11px] md:text-xs font-bold uppercase tracking-widest transform transition-all duration-500 translate-y-10 opacity-0 border pointer-events-auto max-w-sm ${selected.cls}`;
        toast.innerHTML = `<span class="shrink-0">${selected.icon}</span><span>${safeMessage}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    },

    // --------------------------------------------------
    // 5. GÜVENLİK KAPISI
    // --------------------------------------------------
    triggerVerificationGate: (silent = false) => {
        if (!STATE.isLoggedIn()) {
            if (!silent) UI.showToast('İşlem yapabilmek için sisteme giriş yapmalısınız.', 'error');
            return false;
        }

        const user = getUser();
        const votePower = getVotePowerNumber(user);
        const isVerified = user.authStage === 'pdf_verified' || votePower >= 1;

        if (isVerified) return true;

        if (!silent) {
            if (user.authStage === 'document_pending') {
                UI.showToast('Mesleki belge başvurunuz inceleme kuyruğunda. Onay sonrası tam erişim açılacak.', 'info');
            } else if (user.hasPhone) {
                UI.showToast('Telefon doğrulandı. Tam erişim için mesleki belgenizi incelemeye göndermelisiniz.', 'info');
            } else {
                UI.showToast('Bu alan doğrulanmış İçmimarlık Mezunları ve İçmimarlık Öğrencileri içindir. Sicilinizi tamamlamalısınız.', 'error');
            }

            UI.switchSaasTab('view-profil');
        }

        return false;
    },

    // --------------------------------------------------
    // 6. PROFİL MOTORU
    // --------------------------------------------------
    renderProfile: () => {
        if (!STATE.isLoggedIn()) return;

        const user = getUser();
        const selectedCity = isCitySelected(user.city);
        const roleText = getDisplayRole(user);
        const accessText = getAccessLabel(user);
        const digitalId = getDigitalId(user);
        const hasNumber = digitalId !== 'TR-IA-BEKLEYEN';
        const inviteCount = Number(user.inviteCount || 0);
        const progressPercent = Math.min((inviteCount / 3) * 100, 100);

        setText('ui-user-city', selectedCity ? user.city : 'TRİBÜN SEÇİLMEDİ');
        setText('ui-user-role', roleText);
        setText('ui-vote-power', accessText);
        setText('sidebar-user-role', roleText);
        setText('sidebar-vote-power', accessText);
        setText('ui-user-id', digitalId);
        setText('sidebar-user-id', digitalId);
        setText('mobile-user-id', digitalId);
        setText('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);
        setText('ui-invite-link', buildInviteLink(user));

        const progressBar = $('ui-vip-progress-bar');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;

        const cityGate = $('ui-city-selector-container');
        if (cityGate) cityGate.classList.toggle('hidden', selectedCity);

        const roleBadge = $('ui-role-badge');
        if (roleBadge) {
            if (hasNumber && user.isVip) {
                roleBadge.textContent = 'VIP KURUCU';
                roleBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos';
            } else if (hasNumber) {
                roleBadge.textContent = 'ASİL KURUCU';
                roleBadge.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold';
            } else {
                roleBadge.textContent = 'ADAY KURUCU';
                roleBadge.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold';
            }
        }

        UI.renderSystemStatus(user);
        UI.renderVerificationTasks(user);
        UI.renderVipStatus(user, hasNumber, inviteCount);
        UI.renderMentorPreference(user);
    },

    renderSystemStatus: (user) => {
        const textEl = $('ui-sistem-durumu');
        if (!textEl) return;

        const box = textEl.parentElement;
        const title = textEl.previousElementSibling;

        if (user.authStage === 'pdf_verified') {
            textEl.textContent = 'Tebrikler. Mesleki belge başvurunuz onaylandı. Artık sistemde tam erişim hakkına sahipsiniz; sandıklarda oy kullanabilir ve kendi önergenizi sunabilirsiniz.';
            if (box) box.className = 'bg-green-900/20 border border-green-500/30 p-6 rounded-2xl';
            if (title) {
                title.className = 'text-green-400 text-xs font-black tracking-widest uppercase mb-3';
                title.textContent = 'Sistem Durumu: Tam Erişim';
            }
            return;
        }

        if (user.authStage === 'document_pending') {
            textEl.textContent = 'Mesleki belge başvurunuz ön inceleme kuyruğunda. Kontroller tamamlandığında ve başvurunuz onaylandığında tam erişim açılacaktır.';
            if (box) box.className = 'bg-yellow-900/20 border border-yellow-500/30 p-6 rounded-2xl';
            if (title) {
                title.className = 'text-yellow-400 text-xs font-black tracking-widest uppercase mb-3';
                title.textContent = 'Sistem Durumu: İncelemede';
            }
            return;
        }

        if (user.hasPhone) {
            textEl.textContent = 'Telefon doğrulamanız tamamlandı. Tam erişim için mesleki belge inceleme başvurunuzu göndermeniz gerekir.';
            if (box) box.className = 'bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl';
            if (title) {
                title.className = 'text-blue-400 text-xs font-black tracking-widest uppercase mb-3';
                title.textContent = 'Sistem Durumu: Eksik Yetki';
            }
            return;
        }

        textEl.textContent = 'Sisteme hoş geldiniz. Şu an meclisi izleyebilirsiniz. Oy kullanmak, önerge vermek ve ortak akla katkı sunmak için telefon doğrulaması ve mesleki belge inceleme başvurusu gerekir.';
        if (box) box.className = 'bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl';
        if (title) {
            title.className = 'text-gray-400 text-xs font-black tracking-widest uppercase mb-3';
            title.textContent = 'Sistem Durumu: Kayıtlı İzleyici';
        }
    },

    renderVerificationTasks: (user) => {
        const btnPhone = $('btn-open-phone-modal');
        const btnPdf = $('btn-open-pdf-modal');
        const taskContainer = btnPhone ? btnPhone.parentElement : null;

        document.querySelectorAll('.dynamic-task-badge').forEach((el) => el.remove());

        const addBadge = (html, extraClass = '') => {
            if (!taskContainer) return;

            const badge = document.createElement('div');
            badge.className = `dynamic-task-badge w-full py-3 rounded-lg text-[10px] md:text-xs text-center uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-2 border ${extraClass}`;
            badge.innerHTML = html;
            taskContainer.insertBefore(badge, taskContainer.firstChild);
        };

        if (btnPhone) {
            btnPhone.classList.toggle('hidden', Boolean(user.hasPhone));
            btnPhone.textContent = '📱 Telefonu Doğrula';
        }

        if (user.hasPhone) {
            addBadge('✅ TELEFON DOĞRULANDI', 'bg-green-900/20 border-green-700/50 text-green-400');
        }

        if (btnPdf) {
            btnPdf.textContent = '📜 Belge İnceleme Başvurusu Gönder';
        }

        if (user.authStage === 'pdf_verified') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('✅ MESLEKİ BELGE ONAYLI · TAM ERİŞİM', 'bg-indigo-900/20 border-indigo-700/50 text-indigo-400');

            if (user.role && user.role.toLowerCase().includes('öğrenci')) {
                const upgradeButton = document.createElement('button');
                upgradeButton.type = 'button';
                upgradeButton.className = 'dynamic-task-badge w-full bg-kaos text-slate-900 hover:opacity-90 font-black py-3 rounded-lg text-[11px] uppercase tracking-widest transition shadow-md flex items-center justify-center gap-2 mt-2';
                upgradeButton.textContent = 'Mezun Oldun Mu? Unvanını Güncelle';
                upgradeButton.addEventListener('click', () => UI.openModal('pdf-modal'));
                if (taskContainer) taskContainer.appendChild(upgradeButton);
            }

            return;
        }

        if (user.authStage === 'document_pending') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('⏳ BELGE İNCELEME KUYRUĞUNDA', 'bg-yellow-900/20 border-yellow-700/50 text-yellow-500');
            return;
        }

        if (btnPdf) btnPdf.classList.remove('hidden');
    },

    renderVipStatus: (user, hasNumber, inviteCount) => {
        const btnVipModal = $('btn-open-vip-modal');
        const btnStandardNumber = $('btn-standart-numara');
        const vipStatus = $('ui-vip-status');

        if (hasNumber) {
            if (btnVipModal) btnVipModal.classList.add('hidden');
            if (btnStandardNumber) btnStandardNumber.classList.add('hidden');

            if (vipStatus) {
                vipStatus.textContent = user.isVip ? 'VIP KURUCU' : 'SİSTEM ELÇİSİ';
                vipStatus.className = 'text-[9px] text-slate-900 font-black bg-kaos px-2 py-1 rounded border border-kaos shadow-kaos';
            }

            return;
        }

        if (btnVipModal) btnVipModal.classList.remove('hidden');
        if (btnStandardNumber) btnStandardNumber.classList.remove('hidden');

        if (!vipStatus) return;

        if (inviteCount >= 3) {
            vipStatus.textContent = 'KİLİT AÇILDI';
            vipStatus.className = 'text-[9px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-700';
        } else {
            vipStatus.textContent = 'KİLİTLİ';
            vipStatus.className = 'text-[9px] text-gray-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700';
        }
    },

    renderMentorPreference: (user) => {
        const studentArea = $('mentorluk-ogrenci-alani');
        const graduateArea = $('mentorluk-mezun-alani');

        if (!studentArea || !graduateArea) return;

        studentArea.classList.add('hidden');
        studentArea.classList.remove('flex');
        graduateArea.classList.add('hidden');
        graduateArea.classList.remove('flex');

        const role = cleanText(user?.role).toLowerCase();

        if (role.includes('öğrenci')) {
            studentArea.classList.remove('hidden');
            studentArea.classList.add('flex');
        } else if (role && role !== 'belirsiz') {
            graduateArea.classList.remove('hidden');
            graduateArea.classList.add('flex');
        }
    },

    // --------------------------------------------------
    // 7. ÖNERGE / GÜNDEM KARTLARI
    // --------------------------------------------------
    renderProposals: (onergeler) => {
        const proposalsContainer = $('proposals-container');
        const agendaContainer = $('gundem-container');

        if (proposalsContainer) {
            proposalsContainer.classList.remove('hidden');
            proposalsContainer.classList.add('grid');
            proposalsContainer.innerHTML = '';
        }

        if (agendaContainer) {
            agendaContainer.innerHTML = '';
        }

        if (!onergeler || onergeler.length === 0) {
            if (proposalsContainer) proposalsContainer.appendChild(createEmptyState('Bekleyen önerge yok.'));
            if (agendaContainer) agendaContainer.appendChild(createEmptyState('Sırada önerge yok.'));
            return;
        }

        const isAuthorized = UI.triggerVerificationGate(true);
        let proposalCount = 0;
        let agendaCount = 0;

        onergeler.forEach((onerge) => {
            const destekSayisi = Number(onerge.destek_sayisi || 0);
            const isAgenda = destekSayisi >= 50;
            const targetContainer = isAgenda ? agendaContainer : proposalsContainer;

            if (!targetContainer) return;

            const card = isAgenda
                ? UI.createAgendaCard(onerge, isAuthorized)
                : UI.createProposalSupportCard(onerge, isAuthorized);

            targetContainer.appendChild(card);

            if (isAgenda) agendaCount += 1;
            else proposalCount += 1;
        });

        if (proposalsContainer && proposalCount === 0) {
            proposalsContainer.appendChild(createEmptyState('Destek bekleyen önerge yok.'));
        }

        if (agendaContainer && agendaCount === 0) {
            agendaContainer.appendChild(createEmptyState('Gündem sırası şimdilik boş.'));
        }
    },

    createProposalSupportCard: (onerge, isAuthorized) => {
        const destekSayisi = Number(onerge.destek_sayisi || 0);
        const progress = Math.min((destekSayisi / 50) * 100, 100);
        const id = escapeHtml(onerge.id);
        const title = escapeHtml(onerge.baslik || 'Başlıksız Önerge');
        const problem = escapeHtml(truncate(onerge.sorun || 'Sorun açıklaması bulunmuyor.', 220));
        const solution = escapeHtml(truncate(onerge.cozum || '', 180));
        const audience = escapeHtml(onerge.hedef_kitle || 'Herkes');

        const card = document.createElement('div');
        card.className = 'bg-black/40 border border-slate-600 p-5 rounded-2xl relative overflow-hidden shadow-lg mb-3 group';
        card.setAttribute('data-onerge-card', id);

        const lockedOverlay = isAuthorized ? '' : `
            <div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <button type="button" class="btn-goto-profile bg-kaos text-black px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">
                    Kilidi Aç
                </button>
            </div>
        `;

        card.innerHTML = `
            <div class="absolute top-0 left-0 h-1 bg-kaos transition-all" style="width:${progress}%"></div>
            ${lockedOverlay}
            <div class="${isAuthorized ? '' : 'blur-sm opacity-50 select-none pointer-events-none'}">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="flex-grow">
                        <div class="text-[9px] font-black uppercase tracking-widest text-kaos mb-2">${audience}</div>
                        <h3 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">${title}</h3>
                        <p class="text-xs md:text-sm text-gray-300 leading-relaxed mb-3">${problem}</p>
                        ${solution ? `<p class="text-[11px] text-gray-500 leading-relaxed border-l-2 border-slate-700 pl-3">Çözüm: ${solution}</p>` : ''}
                    </div>
                    <div class="md:w-40 shrink-0 flex flex-col gap-3">
                        <div class="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
                            <div class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Destek</div>
                            <div class="text-lg font-black text-kaos">${isAuthorized ? `${destekSayisi}/50` : 'GİZLİ'}</div>
                        </div>
                        <button type="button" data-id="${id}" class="btn-destekle bg-slate-800 border border-slate-600 hover:border-kaos hover:text-kaos text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition">
                            Destekle
                        </button>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.btn-goto-profile')?.addEventListener('click', goToProfile);

        return card;
    },

    createAgendaCard: (onerge, isAuthorized) => {
        const id = escapeHtml(onerge.id);
        const title = escapeHtml(onerge.baslik || 'Başlıksız Gündem');
        const problem = escapeHtml(truncate(onerge.sorun || '', 180));
        const solution = escapeHtml(truncate(onerge.cozum || '', 220));
        const audience = escapeHtml(onerge.hedef_kitle || 'Herkes');
        const authType = getAudienceAuth(onerge.hedef_kitle);

        const card = document.createElement('div');
        card.className = 'bg-black/50 border border-kaos/40 p-5 rounded-2xl relative overflow-hidden shadow-lg mb-4';
        card.setAttribute('data-onerge-card', id);

        const lockedOverlay = isAuthorized ? '' : `
            <div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <button type="button" class="btn-goto-profile bg-kaos text-black px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">
                    Oy İçin Sicilini Tamamla
                </button>
            </div>
        `;

        card.innerHTML = `
            ${lockedOverlay}
            <div class="${isAuthorized ? '' : 'blur-sm opacity-50 select-none pointer-events-none'}">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <span class="text-[9px] font-black uppercase tracking-widest text-kaos">Gündemde · ${audience}</span>
                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">Oylama Açık</span>
                </div>
                <h3 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">${title}</h3>
                ${problem ? `<p class="text-xs md:text-sm text-gray-400 leading-relaxed mb-2">${problem}</p>` : ''}
                ${solution ? `<p class="text-xs md:text-sm text-gray-300 leading-relaxed mb-4 border-l-2 border-kaos/60 pl-3">${solution}</p>` : ''}

                <div class="mb-4">
                    <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex border border-slate-700">
                        <div class="vote-bar-yes bg-green-500 h-full transition-all" style="width:0%"></div>
                        <div class="vote-bar-abstain bg-yellow-500 h-full transition-all" style="width:0%"></div>
                        <div class="vote-bar-no bg-red-500 h-full transition-all" style="width:0%"></div>
                    </div>
                    <div class="flex justify-between text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                        <span class="vote-text-yes">%0 Kabul</span>
                        <span class="vote-text-abstain">%0 Çekimser</span>
                        <span class="vote-text-no">%0 Ret</span>
                    </div>
                </div>

                <div class="vote-buttons-container grid grid-cols-3 gap-2" data-auth="${authType}">
                    <button type="button" class="vote-btn bg-slate-800 border border-slate-600 hover:border-green-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition" data-onerge-id="${id}" data-vote="yes">Kabul</button>
                    <button type="button" class="vote-btn bg-slate-800 border border-slate-600 hover:border-yellow-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition" data-onerge-id="${id}" data-vote="abstain">Çekimser</button>
                    <button type="button" class="vote-btn bg-slate-800 border border-slate-600 hover:border-red-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition" data-onerge-id="${id}" data-vote="no">Ret</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-goto-profile')?.addEventListener('click', goToProfile);

        return card;
    },

    // --------------------------------------------------
    // 8. TRİBÜN LİGİ
    // --------------------------------------------------
    renderTribunLigi: (cityDataArray) => {
        const tableBody = $('tribun-table-body');
        const championsContainer = $('tribun-champions');

        if (!Array.isArray(cityDataArray)) return;

        const user = getUser();
        const userCity = user.city;
        const validUserCity = isCitySelected(userCity);
        const workingData = [...cityDataArray];

        if (validUserCity && !workingData.find((item) => item.city === userCity)) {
            workingData.push({
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

        const calculatePower = (city) => {
            return (
                Number(city.icmimar || 0) * 10 +
                Number(city.ogrenci || 0) * 5 +
                Number(city.onerge || 0) * 2 +
                Number(city.oy || 0) * 1 +
                Number(city.katki || 0) * 2
            );
        };

        const processed = workingData
            .map((city) => ({ ...city, power: calculatePower(city) }))
            .filter((city) => cleanText(city.city))
            .sort((a, b) => b.power - a.power);

        if (championsContainer) {
            if (processed.length === 0) {
                championsContainer.innerHTML = '';
            } else {
                const leader = processed[0];
                const mostActive = [...processed].sort((a, b) => (b.onerge + b.oy + b.katki) - (a.onerge + a.oy + a.katki))[0] || leader;
                const studentLeader = [...processed].sort((a, b) => Number(b.ogrenci || 0) - Number(a.ogrenci || 0))[0] || leader;
                const fastest = [...processed].sort((a, b) => Number(b.weeklyGrowthPercent || 0) - Number(a.weeklyGrowthPercent || 0))[0] || leader;

                championsContainer.innerHTML = `
                    ${UI.createChampionCard('Genel Lider', leader.city, '🏆')}
                    ${UI.createChampionCard('En Aktif Tribün', mostActive.city, '🔥')}
                    ${UI.createChampionCard('Öğrenci Lideri', studentLeader.city, '🎓')}
                    ${UI.createChampionCard('Haftanın Yükseleni', fastest.city, '⚡')}
                `;
            }
        }

        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (processed.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="2" class="p-4 text-center text-gray-500 text-xs uppercase tracking-widest">Henüz tribün verisi yok.</td>';
            tableBody.appendChild(row);
            return;
        }

        processed.forEach((city, index) => {
            const isMine = validUserCity && city.city === userCity;
            const row = document.createElement('tr');
            row.className = isMine
                ? 'bg-kaos/10 border-b border-kaos/30'
                : 'border-b border-slate-800 hover:bg-slate-800/50 transition';

            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

            row.innerHTML = `
                <td class="p-4 font-black text-white text-sm">
                    <span class="mr-2">${medal}</span>${escapeHtml(city.city)}
                    ${isMine ? '<span class="ml-2 text-[9px] text-kaos uppercase tracking-widest">Senin Tribünün</span>' : ''}
                </td>
                <td class="p-4 font-mono font-black text-kaos text-sm">${Number(city.power || 0).toLocaleString('tr-TR')}</td>
            `;

            tableBody.appendChild(row);
        });
    },

    createChampionCard: (label, city, icon) => {
        return `
            <div class="bg-black/40 border border-slate-700 rounded-2xl p-4 text-center shadow-md">
                <div class="text-2xl mb-2">${icon}</div>
                <div class="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">${escapeHtml(label)}</div>
                <div class="text-sm md:text-base font-black text-white truncate">${escapeHtml(city || 'Bekleniyor')}</div>
            </div>
        `;
    }
};

// ------------------------------------------------------
// ESC TUŞU İLE AÇIK MODALLARI KAPAT
// ------------------------------------------------------
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    [
        'ortak-kursu-modal',
        'phone-modal',
        'pdf-modal',
        'vip-modal',
        'dinamik-detay-modal'
    ].forEach((modalId) => {
        const modal = $(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            if (modalId === 'dinamik-detay-modal') modal.remove();
            else UI.closeModal(modalId);
        }
    });
});
