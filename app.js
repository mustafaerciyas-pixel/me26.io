// =========================================================
// ME26 SİSTEM DURUMU VE KİMLİK SİMÜLASYONU
// =========================================================

const STATE = {
    user: null, // Giriş yapmamışsa null
    isLoggedIn: function() {
        return this.user !== null;
    }
};

// Geliştirici Testi: Ekranda hızlıca kimlik değiştirmek için
function setMockUser(role) {
    const badge = document.getElementById('current-user-role');
    if (role === 'içmimar') {
        STATE.user = { job: 'İçmimar', votePower: '1.0x' };
        badge.innerHTML = '<span class="text-green-400 font-bold">Kayıtlı İçmimar (VIP)</span>';
        Me26App.showToast('Sisteme "İçmimar" olarak giriş yapıldı.', 'success');
    } else if (role === 'öğrenci') {
        STATE.user = { job: 'İçmimarlık Öğrencisi', votePower: '0.5x' };
        badge.innerHTML = '<span class="text-blue-400 font-bold">Öğrenci Temsilcisi</span>';
        Me26App.showToast('Sisteme "Öğrenci" olarak giriş yapıldı.', 'success');
    } else {
        STATE.user = null;
        badge.innerHTML = 'Giriş Yapılmadı';
        Me26App.showToast('Sistemden çıkış yapıldı.', 'info');
    }
}

// =========================================================
// ME26 ANA UYGULAMA VE OYLAMA MOTORU
// =========================================================

const Me26App = {
    init: function() {
        // Tüm oylama butonlarını dinle
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e.target));
        });
        console.log("Me26 Sistem İçmimarı Motoru Başlatıldı.");
    },

    handleVote: function(btnEl) {
        // 1. Giriş Kontrolü
        if (!STATE.isLoggedIn()) {
            this.showToast('Sandığa erişim reddedildi. Önce giriş yapmalısınız!', 'error');
            return;
        }

        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); 
        const userJob = STATE.user.job.toLowerCase();
        const choice = btnEl.getAttribute('data-vote');

        // 2. YETKİ (FİLTRE) KONTROLÜ
        if (requiredAuth === 'icmimar' && !userJob.includes('içmimar') && !userJob.includes('mimar')) {
            this.showToast('Erişim Engellendi: Bu önergeyi sadece Profesyonel İçmimarlar oylayabilir.', 'error');
            return;
        }
        
        if (requiredAuth === 'ogrenci' && !userJob.includes('öğrenci')) {
            this.showToast('Erişim Engellendi: Bu önerge sadece Öğrencilerin oylamasına açıktır.', 'error');
            return;
        }

        // 3. UI GÜNCELLEMESİ (Tıklananı parlat, diğerlerini kilitle)
        const allButtons = container.querySelectorAll('.vote-btn');
        allButtons.forEach(b => {
            b.disabled = true;
            b.classList.remove('hover:border-green-500', 'hover:border-yellow-500', 'hover:border-red-500');
            b.classList.add('opacity-30', 'cursor-not-allowed');
        });

        btnEl.classList.remove('opacity-30', 'bg-slate-800', 'text-gray-400');
        
        if (choice === 'yes') {
            btnEl.classList.add('bg-green-900/50', 'border-green-500', 'text-green-400');
        } else if (choice === 'abstain') {
            btnEl.classList.add('bg-yellow-900/50', 'border-yellow-500', 'text-yellow-400');
        } else if (choice === 'no') {
            btnEl.classList.add('bg-red-900/50', 'border-red-500', 'text-red-400');
        }

        // 4. CANLI SONUÇ ANİMASYONU
        this.animateResults(container.parentElement, choice);
        
        const votePower = STATE.user.votePower || '1.0x';
        this.showToast(`Oyunuz blokzincire başarıyla eklendi! (Güç: ${votePower})`, 'success');
    },

    animateResults: function(cardEl, userChoice) {
        // Mevcut oyların üzerine kullanıcının oyunu simüle ederek ekler
        let baseYes = Math.floor(Math.random() * 40) + 20; 
        let baseAbstain = Math.floor(Math.random() * 10) + 5;
        let baseNo = 100 - (baseYes + baseAbstain);

        if (userChoice === 'yes') baseYes += 20;
        if (userChoice === 'abstain') baseAbstain += 20;
        if (userChoice === 'no') baseNo += 20;

        const total = baseYes + baseAbstain + baseNo;
        const percYes = Math.round((baseYes / total) * 100);
        const percAbstain = Math.round((baseAbstain / total) * 100);
        const percNo = 100 - (percYes + percAbstain);

        const barYes = cardEl.querySelector('.vote-bar-yes');
        const barAbstain = cardEl.querySelector('.vote-bar-abstain');
        const barNo = cardEl.querySelector('.vote-bar-no');
        
        const textYes = cardEl.querySelector('.vote-text-yes');
        const textAbstain = cardEl.querySelector('.vote-text-abstain');
        const textNo = cardEl.querySelector('.vote-text-no');

        // Akıcı animasyon için ufak bir gecikme
        setTimeout(() => {
            if (barYes) barYes.style.width = percYes + '%';
            if (barAbstain) barAbstain.style.width = percAbstain + '%';
            if (barNo) barNo.style.width = percNo + '%';

            if (textYes) textYes.textContent = `%${percYes} Kabul`;
            if (textAbstain) textAbstain.textContent = `%${percAbstain} Çekimser`;
            if (textNo) textNo.textContent = `%${percNo} Ret`;
        }, 50);
    },

    // Sistemin Canlı Bildirim (Toast) Aracı
    showToast: function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `p-3 rounded shadow-lg text-sm font-bold text-white flex items-center gap-2 toast-animate mb-2 max-w-xs`;
        
        let icon = '<i class="fas fa-info-circle"></i>';
        if (type === 'success') {
            toast.classList.add('bg-green-600', 'border', 'border-green-400');
            icon = '<i class="fas fa-check-circle"></i>';
        } else if (type === 'error') {
            toast.classList.add('bg-red-600', 'border', 'border-red-400');
            icon = '<i class="fas fa-exclamation-triangle"></i>';
        } else {
            toast.classList.add('bg-blue-600', 'border', 'border-blue-400');
        }

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        // 3 saniye sonra kaybolur
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// HTML yüklendiğinde sistemi ateşle
document.addEventListener('DOMContentLoaded', () => {
    Me26App.init();
});
