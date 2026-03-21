/**
 * Dr Pay - Core Application Logic
 */

let currentUser = null;
let allServices = [];
let favorites = JSON.parse(localStorage.getItem('drpay_favs') || '[]');
let isSoundEnabled = localStorage.getItem('drpay_sound') !== 'false';
let currentService = null;

const sounds = {
    success: new Audio('sounds/success.mp3'),
    error: new Audio('sounds/error.mp3')
};

function playSound(type) {
    if (isSoundEnabled && sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(() => {});
    }
}

async function fetchAPI(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('drpay_token');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`/api/index.js?action=${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) logout();
            toast(data.error || 'خطأ في العملية');
            return null;
        }
        return data;
    } catch (error) { return null; }
}

function toast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[100] transition-all transform translate-y-10 opacity-0';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.remove('translate-y-10', 'opacity-0'); }, 10);
    setTimeout(() => { t.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('drpay_theme', isLight ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const isLight = localStorage.getItem('drpay_theme') === 'light';
    document.body.classList.toggle('light-theme', isLight);
    const btn = document.getElementById('toggle-theme-btn');
    if (btn) {
        btn.innerHTML = isLight ? '<i data-lucide="moon" class="w-5 h-5"></i> وضع الليلي' : '<i data-lucide="sun" class="w-5 h-5"></i> وضع النهاري';
        btn.className = isLight 
            ? "w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 bg-slate-900 text-white shadow-xl"
            : "w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 bg-white text-slate-900 shadow-xl border border-slate-200";
    }
    lucide.createIcons();
}

function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    s.classList.toggle('translate-x-full');
    o.classList.toggle('hidden');
}

function openView(v) { 
    const views = ['home','wallet','reports','settings','sett-profile', 'sett-security', 'sett-devices','add-merch','support'];
    views.forEach(id => {
        const el = document.getElementById('view-'+id);
        if (el) el.classList.add('hidden-view');
    });
    
    const target = document.getElementById('view-'+v);
    if (target) {
        target.classList.remove('hidden-view');
    }
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navId = (v.startsWith('sett-')) ? 'nav-settings' : 'nav-' + v;
    const navBtn = document.getElementById(navId);
    if (navBtn) navBtn.classList.add('active');
    
    if (v === 'settings' || v.startsWith('sett-')) {
        loadMe();
        const distTools = document.querySelectorAll('.dist-only');
        distTools.forEach(el => el.classList.toggle('hidden', currentUser?.role !== 'distributor' && currentUser?.role !== 'admin'));
    }
    if (v === 'sett-devices') loadDevices();
    
    window.scrollTo({top: 0, behavior: 'smooth'});
    if(document.getElementById('sidebar')) {
        document.getElementById('sidebar').classList.add('translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }
    lucide.createIcons();
}

function openSettingsSub(sub) { openView('sett-' + sub); }

async function loadMe() {
    const data = await fetchAPI('me');
    if(data) {
        currentUser = data.user;
        document.getElementById('user-balance').innerHTML = `${data.user.balance.toFixed(2)} <span class="text-[10px] text-emerald-300">ج.م</span>`;
        if (document.getElementById('side-balance')) document.getElementById('side-balance').innerHTML = `${data.user.balance.toFixed(2)} <span class="text-[10px] text-emerald-300">ج.م</span>`;
        document.getElementById('header-shop-name').textContent = data.user.shop_name || data.user.name;
        if (document.getElementById('sett-profile-name')) document.getElementById('sett-profile-name').textContent = data.user.name;
        if (document.getElementById('user-role-badge')) document.getElementById('user-role-badge').textContent = data.user.role === 'distributor' ? 'وكيل توزيع' : 'تاجر';
        
        // Cache user info
        localStorage.setItem('drpay_user', JSON.stringify(data.user));
    }
}

async function loadCategories(force = false) {
    const cached = localStorage.getItem('drpay_cats');
    if (cached && !force) {
        renderCategories(JSON.parse(cached));
    }

    if (!cached || force) {
        const data = await fetchAPI('categories');
        if(data) {
            localStorage.setItem('drpay_cats', JSON.stringify(data.categories));
            renderCategories(data.categories);
        }
    }
}

function renderCategories(categories) {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;
    grid.innerHTML = '';
    categories.forEach(c => {
        const card = document.createElement('div');
        card.className = "cat-card p-4 rounded-[1.8rem] flex flex-col items-center justify-center gap-3 text-center group";
        card.onclick = () => openServicesModal(c.name, c.id);
        card.innerHTML = `
            <div class="w-14 h-14 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <i data-lucide="${c.icon || 'layers'}" class="w-7 h-7"></i>
            </div>
            <span class="text-[11px] font-black leading-tight text-white">${c.name}</span>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

async function loadAllServices(force = false) {
    const cached = localStorage.getItem('drpay_services');
    if (cached && !force) {
        allServices = JSON.parse(cached);
        return;
    }
    
    const data = await fetchAPI('services');
    if (data) {
        allServices = data.services;
        localStorage.setItem('drpay_services', JSON.stringify(data.services));
    }
}

async function refreshSystem() {
    const btn = document.getElementById('refresh-system-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="animate-spin w-4 h-4"></i> جاري التحديث...';
        lucide.createIcons();
    }
    
    await loadMe();
    await loadCategories(true);
    await loadAllServices(true);
    renderFavorites();
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="refresh-cw" class="w-5 h-5"></i> تحديث الخدمات والنظام';
        lucide.createIcons();
    }
    toast('🚀 تم تحديث النظام والخدمات بنجاح');
}

async function openServicesModal(name, catId = null) {
    document.getElementById('modal-title').textContent = name;
    document.getElementById('services-modal').classList.remove('hidden');
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '<div class="col-span-full py-10 text-center text-slate-500">جاري تحميل الخدمات...</div>';
    
    // Use cached allServices if possible, or filter global cache
    if (allServices.length > 0) {
        renderServicesFiltered(catId);
        return;
    }

    const endpoint = catId ? `services?category_id=${catId}` : 'services';
    const data = await fetchAPI(endpoint);
    if(data) {
        allServices = data.services;
        renderServicesFiltered(catId);
    }
}

function renderServicesFiltered(catId) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';
    const q = document.getElementById('service-search').value.toLowerCase();
    
    let filtered = allServices;
    if (catId) filtered = filtered.filter(s => s.category_id === catId);
    filtered = filtered.filter(s => s.name.toLowerCase().includes(q));
    
    filtered.forEach(s => {
        const card = document.createElement('div');
        card.className = "cat-card p-4 rounded-[1.8rem] flex flex-col items-center justify-center gap-3 text-center relative group";
        card.onclick = () => openService(s);
        
        const isFav = favorites.includes(s.id);
        card.innerHTML = `
            <button onclick="toggleFavorite(event, '${s.id}')" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/40 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-75 ${isFav ? 'text-yellow-400' : 'text-white/30'}">
                <i data-lucide="star" class="w-3.5 h-3.5 ${isFav ? 'fill-yellow-400' : ''}"></i>
            </button>
            <div class="w-14 h-14 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <i data-lucide="${s.icon || 'layers'}" class="w-7 h-7"></i>
            </div>
            <span class="text-[11px] font-black leading-tight text-white">${s.name}</span>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
    renderFavorites();
}

function toggleFavorite(e, id) {
    e.stopPropagation();
    const idx = favorites.indexOf(id);
    if (idx > -1) favorites.splice(idx, 1);
    else favorites.push(id);
    localStorage.setItem('drpay_favs', JSON.stringify(favorites));
    renderServices(); renderFavorites(); playSound('success');
}

function renderFavorites() {
    const grid = document.getElementById('favorites-grid');
    const section = document.getElementById('favorites-section');
    if (!grid || !section) return;
    grid.innerHTML = '';
    const favItems = allServices.filter(s => favorites.includes(s.id));
    if (favItems.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    favItems.forEach(s => {
        const card = document.createElement('div');
        card.className = "cat-card p-3 rounded-2xl flex flex-col items-center justify-center gap-2 text-center relative group";
        card.onclick = () => openService(s);
        card.innerHTML = `
            <div class="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                <i data-lucide="${s.icon || 'layers'}" class="w-5 h-5"></i>
            </div>
            <span class="text-[9px] font-black leading-tight text-white line-clamp-1">${s.name}</span>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function closeServicesModal() { document.getElementById('services-modal').classList.add('hidden'); }

function openService(s) {
    currentService = s;
    document.getElementById('pay-title').textContent = s.name;
    document.getElementById('pay-amt-box').classList.toggle('hidden', s.price > 0);
    document.getElementById('price-info').classList.toggle('hidden', s.price <= 0);
    if(s.price > 0) document.getElementById('pay-price').textContent = s.price.toFixed(2);
    document.getElementById('payment-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closePaymentModal() { document.getElementById('payment-modal').classList.add('hidden'); }

async function loadDevices() {
    const table = document.getElementById('connected-devices-table');
    if(!table) return;
    table.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">جاري التحميل...</td></tr>`;
    const res = await fetchAPI('me/devices');
    if (res && res.success) {
        table.innerHTML = '';
        res.devices.forEach(d => {
            const row = document.createElement('tr'); row.className = "border-b border-white/5 hover:bg-white/5 transition-colors";
            const isCurrent = d.fingerprint === localStorage.getItem('drpay_fp');
            row.innerHTML = `
                <td class="px-4 py-4"><div class="flex items-center gap-2"><i data-lucide="${d.os === 'Windows' ? 'monitor' : 'smartphone'}" class="w-4 h-4 text-blue-400"></i> ${d.browser || 'غير معروف'} (${d.os})</div></td>
                <td class="px-4 py-4 font-mono text-slate-400">${d.ip}</td>
                <td class="px-4 py-4 font-mono text-blue-300">${d.fingerprint.substring(0, 8)}...</td>
                <td class="px-4 py-4 text-[9px] text-slate-500">${new Date(d.last_login).toLocaleString('ar-EG')}</td>
                <td class="px-4 py-4">${isCurrent ? '<span class="text-emerald-500 font-bold">هذا الجهاز</span>' : `<button onclick="deleteDevice('${d.id}')" class="bg-red-500/10 text-red-500 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition flex items-center gap-1"><i data-lucide="trash-2" class="w-3 h-3"></i> حذف</button>`}</td>
            `;
            table.appendChild(row);
        });
        lucide.createIcons();
    }
}

async function deleteDevice(id) {
    if(!confirm('هل أنت متأكد من حذف هذا الجهاز؟')) return;
    const res = await fetchAPI('me/devices/' + id, 'DELETE');
    if(res && res.success) { toast('تم حذف الجهاز بنجاح'); loadDevices(); }
}

function logout() { localStorage.clear(); window.location.href = 'login.html'; }

// Password Reset Functions
function openResetModal() {
    document.getElementById('reset-modal').classList.remove('hidden');
    setTimeout(() => { 
        document.getElementById('reset-modal').classList.add('opacity-100'); 
        document.getElementById('reset-card').classList.remove('scale-95'); 
    }, 10);
    document.getElementById('reset-step-1').classList.remove('hidden');
    document.getElementById('reset-step-2').classList.add('hidden');
    document.getElementById('reset-step-3').classList.add('hidden');
    lucide.createIcons();
}

function closeResetModal() {
    document.getElementById('reset-modal').classList.remove('opacity-100');
    document.getElementById('reset-card').classList.add('scale-95');
    setTimeout(() => { document.getElementById('reset-modal').classList.add('hidden'); }, 300);
}

async function resetVerifyStep1(event) {
    const id = document.getElementById('reset-national-id').value;
    const phone = document.getElementById('reset-phone').value;
    if (id.length !== 14 || phone.length < 11) return toast('يرجي التأكد من صحة البيانات');
    const btn = event.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="animate-spin w-4 h-4"></i> جاري التحقق...';
    lucide.createIcons();
    const res = await fetchAPI('request_password_reset', 'POST', { national_id: id, phone: phone });
    btn.innerHTML = original; lucide.createIcons();
    if (res && res.success) {
        document.getElementById('reset-step-1').classList.add('hidden');
        document.getElementById('reset-step-2').classList.remove('hidden');
        document.getElementById('reset-phone-last').textContent = phone.slice(-4);
        toast('تم إرسال كود التحقق بنجاح');
    }
}

async function resetVerifyOTP() {
    const code = document.getElementById('reset-otp-code').value;
    const res = await fetchAPI('verify_password_reset_otp', 'POST', { code: code });
    if (res && res.success) {
        document.getElementById('reset-step-2').classList.add('hidden');
        document.getElementById('reset-step-3').classList.remove('hidden');
        toast('تم التحقق من الكود بنجاح');
    }
    lucide.createIcons();
}

async function resetFinalUpdate() {
    const p1 = document.getElementById('reset-new-pass').value;
    const p2 = document.getElementById('reset-new-pass-confirm').value;
    if (p1.length < 4) return toast('كلمة المرور قصيرة جداً');
    if (p1 !== p2) return toast('كلمات المرور غير متطابقة');
    const res = await fetchAPI('change_password_final', 'POST', { password: p1 });
    if (res && res.success) { toast('🎉 تم تغيير كلمة المرور بنجاح'); closeResetModal(); }
}

// Payment & Receipt
async function handlePayment(e) {
    e.preventDefault();
    const btn = document.getElementById('pay-confirm-btn');
    const num = document.getElementById('pay-number').value;
    let amt = currentService.price > 0 ? currentService.price : document.getElementById('pay-amount-val').value;
    btn.disabled = true; btn.innerHTML = 'جاري التنفيذ...';
    const res = await fetchAPI('me/pay', 'POST', { service_id: currentService.id, target: num, amount: amt });
    if(res && res.success) {
        closePaymentModal(); closeServicesModal(); playSound('success');
        showReceipt({ 
            service_name: currentService.name, number: num, 
            amount: amt, fee: 0, total: amt, ref: res.transaction.id.split('-')[0].toUpperCase() 
        });
        toast('تمت عملية الدفع بنجاح'); loadMe();
    } else { playSound('error'); alert(res?.error || 'فشلت العملية'); }
    btn.disabled = false; btn.innerHTML = 'تنفيذ العملية الآن <i data-lucide="arrow-left-circle" class="w-5 h-5"></i>';
    lucide.createIcons();
}

function showReceipt(data) {
    document.getElementById('re-date').textContent = new Date().toLocaleString('ar-EG');
    document.getElementById('receipt-service').textContent = data.service_name;
    document.getElementById('re-phone').textContent = data.number;
    document.getElementById('re-val').textContent = data.amount;
    document.getElementById('re-total').textContent = data.total;
    document.getElementById('re-ref').textContent = data.ref;
    document.getElementById('receipt-modal').classList.remove('hidden');
    lucide.createIcons();
}

function closeReceipt() { document.getElementById('receipt-modal').classList.add('hidden'); }
function printReceipt() { const content = document.getElementById('receipt-print-area').innerHTML; document.body.innerHTML = content; window.print(); location.reload(); }
function shareReceipt() { const text = `*إيصال دفع Dr Pay*\n\nالخدمة: ${document.getElementById('receipt-service').textContent}\nالرقم: ${document.getElementById('re-phone').textContent}\nالقيمة: ${document.getElementById('re-total').textContent} ج.م\nالمرجع: ${document.getElementById('re-ref').textContent}\n\nشكراً لك!`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('drpay_sound', isSoundEnabled);
    const btn = document.getElementById('toggle-sound');
    if(btn) {
        btn.innerHTML = isSoundEnabled ? '<i data-lucide="volume-2" class="w-4 h-4"></i> مفعل' : '<i data-lucide="volume-x" class="w-4 h-4"></i> صامت';
        btn.className = isSoundEnabled ? 'bg-indigo-600/10 text-indigo-400 w-full py-4 rounded-2xl flex items-center justify-center gap-2 border border-indigo-500/10 font-black' : 'bg-slate-900/50 text-slate-500 w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black';
    }
    lucide.createIcons();
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    const u = localStorage.getItem('drpay_user');
    if(!u) { window.location.href = 'login.html'; return; }
    currentUser = JSON.parse(u);
    loadMe(); 
    loadCategories(); 
    loadAllServices();
    renderFavorites();
    
    document.getElementById('payment-form')?.addEventListener('submit', handlePayment);
    document.getElementById('add-merch-form')?.addEventListener('submit', (e) => {
       e.preventDefault(); toast('تم استلام الطلب وبانتظار الموافقة'); openView('settings');
    });

    setInterval(loadMe, 15000);
});
