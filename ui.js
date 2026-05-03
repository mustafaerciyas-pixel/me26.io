// ... (diğer UI kodları)

    // 4. BİLDİRİM (TOAST) SİSTEMİ
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const colors = type === 'error' ? 'bg-red-600 text-white' : 'bg-kaos text-slate-900';
        toast.className = `${colors} px-5 py-3 rounded-xl shadow-lg font-black text-xs uppercase tracking-widest transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2`;
        
        // GÜVENLİK GÜNCELLEMESİ: innerHTML yerine textContent kullanıldı
        toast.textContent = (type === 'success' ? '⚡ ' : '⚠️ ') + message;
        
        container.appendChild(toast);

        // ... (animasyon kodları devam eder)
