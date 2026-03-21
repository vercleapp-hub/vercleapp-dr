/**
 * Dr Pay - Admin Dashboard Logic
 */

// Immediate Security Check
(function() {
    const userStr = localStorage.getItem('drpay_user');
    const token = localStorage.getItem('drpay_token');
    if (!userStr || !token) { window.location.href = 'login.html'; return; }
    const cUser = JSON.parse(userStr);
    if (cUser.role !== 'admin') { 
        alert('غير مصرح لك بدخول هذه اللوحة.'); 
        window.location.href = 'index.html'; 
        return;
    }
    window.currentUser = cUser;
})();

let currentUser = window.currentUser;

// Security logic: Disable Right-click and inspect tools
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = function(e) {
    if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 'I'.charCodeAt(0) || e.keyCode == 'C'.charCodeAt(0) || e.keyCode == 'J'.charCodeAt(0) || e.keyCode == 'U'.charCodeAt(0)))) {
        return false;
    }
};

function showLoader(show) { document.getElementById('loader').classList[show ? 'remove' : 'add']('hidden'); }
function toast(msg) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toast-msg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.remove('translate-y-24');
    setTimeout(() => t.classList.add('translate-y-24'), 3000);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('drpay_theme', isLight ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const isLight = localStorage.getItem('drpay_theme') === 'light';
    document.body.classList.toggle('light-theme', isLight);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = isLight ? '<i data-lucide="moon" class="w-4 h-4"></i>' : '<i data-lucide="sun" class="w-4 h-4"></i>';
    }
    lucide.createIcons();
}

async function fetchAPI(endpoint, method = 'GET', body = null) {
    showLoader(true);
    try {
        const res = await fetch(`/api/index.js?action=${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('drpay_token')}`
            },
            body: body ? JSON.stringify(body) : null
        });
        const data = await res.json();
        showLoader(false);
        if (data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        showLoader(false);
        toast(e.message || 'خطأ في الاتصال');
        if (e.message.includes('غير مصرح')) { logout(); }
        return null;
    }
}

const views = ['dashboard', 'users', 'deposits', 'services', 'categories', 'cards', 'methods', 'transactions', 'branches', 'employees', 'logs', 'settings'];
const viewTitles = {
    'dashboard': 'لوحة المراقبة الأساسية', 'users': 'الأعضاء والتجار وقواعد البيانات', 'deposits': 'إدارة طلبات شحن الأرصدة',
    'services': 'الخدمات والمبيعات', 'categories': 'أقسام الخدمات', 'cards': 'مخزن كروت الشحن',
    'methods': 'طرق الدفع والتحويل', 'transactions': 'مراقبة الفواتير وأرشيف السيستم',
    'branches': 'إدارة الفروع', 'employees': 'إدارة الموظفين', 'logs': 'سجل النشاط الكامل', 'settings': 'إعدادات النظام المحورية',
    'tickets': 'تذاكر الدعم الفني'
};

function openView(v) {
    views.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        if (el) el.classList.add('hidden-view');
    });
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(`view-${v}`);
    if (target) target.classList.remove('hidden-view');

    if (event && event.currentTarget && event.currentTarget.classList.contains('sidebar-item')) {
        event.currentTarget.classList.add('active');
    } else {
        // Find the button in sidebar and set active
        const btns = document.querySelectorAll('.sidebar-item');
        btns.forEach(b => {
            if (b.getAttribute('onclick')?.includes(`'${v}'`)) b.classList.add('active');
        });
    }

    document.getElementById('view-title').innerHTML = `<i data-lucide="box" class="text-blue-500"></i> ${viewTitles[v]}`;
    lucide.createIcons();

    if (v === 'users') loadUsers();
    else if (v === 'services') loadServices();
    else if (v === 'categories') loadCategories();
    else if (v === 'cards') loadCards();
    else if (v === 'methods') loadMethods();
    else if (v === 'deposits') loadDeposits();
    else if (v === 'transactions') loadTransactions();
    else if (v === 'settings') loadSettings();
    else if (v === 'branches') loadBranches();
    else if (v === 'employees') loadEmployees();
    else if (v === 'logs') loadFullLogs();
    else if (v === 'tickets') loadTickets();
}

function filterTable(tableId, query) {
    const q = query.toLowerCase();
    const rows = document.querySelectorAll(`#${tableId} tr`);
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

async function refreshData() {
    const data = await fetchAPI('admin/stats');
    if (data) {
        document.getElementById('stat-users').textContent = data.stats.totalUsers || 0;
        document.getElementById('stat-revenue').textContent = data.stats.revenue?.toFixed(2) || '0.00';
        document.getElementById('stat-tx').textContent = data.stats.totalTransactions || 0;
        document.getElementById('stat-daily').textContent = data.stats.dailyTx || 0;
    }
    const lData = await fetchAPI('logs');
    if (lData) {
        const tbody = document.getElementById('logs-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        lData.logs.slice(0, 10).forEach(l => {
            const un = l.custom_users ? l.custom_users.name : 'محذوف';
            tbody.innerHTML += `<tr><td class="text-[10px] text-slate-400 font-mono">${new Date(l.created_at).toLocaleString('ar-EG')}</td><td class="font-bold text-blue-300 w-32">${un}</td><td class="text-xs bg-slate-800 rounded px-2 text-center text-slate-300 w-24">${l.action}</td><td class="text-slate-300">${l.details}</td></tr>`;
        });
    }
}

async function loadUsers() {
    const data = await fetchAPI('admin/users');
    if (data) {
        const tbody = document.getElementById('users-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.users.forEach(u => {
            const wallet = u.wallets && u.wallets.length ? u.wallets[0] : { balance: 0, golden_points: 0, credit_limit: 0 };
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-slate-800/30 transition">
                    <td class="p-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner"><i data-lucide="user" class="w-5 h-5"></i></div>
                            <div class="flex flex-col">
                                <span class="text-white font-black text-sm">${u.name}</span>
                                <span class="text-[10px] text-blue-400 font-bold">${u.shop_name || 'بدون اسم محل'}</span>
                                <span class="text-[9px] text-slate-500 font-mono tracking-tighter">${u.phone}</span>
                            </div>
                        </div>
                    </td>
                    <td class="text-slate-400 text-[10px] font-bold text-center">${u.province || '-'}</td>
                    <td class="p-3 text-center">
                        <div class="flex flex-col items-center">
                            <span class="font-black text-emerald-400 font-mono text-base tracking-tighter">${wallet.balance.toFixed(2)}</span>
                            <div class="flex gap-2 mt-1">
                                <span class="text-[8px] bg-yellow-500/10 text-yellow-500 px-1.5 rounded-lg border border-yellow-500/20 font-bold">نقاط: ${wallet.golden_points || 0}</span>
                                <span class="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 rounded-lg border border-indigo-500/20 font-bold">آجل: ${wallet.credit_limit || 0}</span>
                            </div>
                        </div>
                    </td>
                    <td><select onchange="updateUser('${u.id}', 'role', this.value)" class="text-[10px] p-1.5 rounded-xl bg-slate-900 border-slate-700 text-white w-full"><option value="user" ${u.role === 'user' ? 'selected' : ''}>مستخدِم</option><option value="employee" ${u.role === 'employee' ? 'selected' : ''}>موظف</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>إدارة</option></select></td>
                    <td><select onchange="updateUser('${u.id}', 'status', this.value)" class="text-[10px] p-1.5 rounded-xl bg-slate-900 border-slate-700 w-full ${u.status === 'active' ? 'text-emerald-400' : 'text-red-400'} font-bold"><option value="active" ${u.status === 'active' ? 'selected' : ''}>نشط</option><option value="blocked" ${u.status === 'blocked' ? 'selected' : ''}>محظور</option></select></td>
                    <td class="p-3">
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="openModal('balance', '${u.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-[9px] font-black transition shadow-lg">إيداع</button>
                            <button onclick="openWalletEdit('${u.id}', ${wallet.golden_points || 0}, ${wallet.credit_limit || 0})" class="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg text-[9px] font-black transition shadow-lg">المحفظة</button>
                            <button onclick='openUserDetails(${JSON.stringify(u)})' class="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg text-[9px] font-black transition shadow-lg">التفاصيل</button>
                            <button onclick="resetDevices('${u.id}')" class="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded-lg text-[9px] font-black transition shadow-lg">أجهزة</button>
                            <button onclick="changePass('${u.id}')" class="col-span-2 bg-slate-900/50 hover:bg-slate-800 text-slate-300 p-1.5 rounded-lg text-[9px] font-black transition border border-white/5 shadow-inner">تغيير السر</button>
                        </div>
                    </td>
                </tr>`;
        });
        lucide.createIcons();
    }
}

async function updateUser(id, field, value) {
    const up = { id }; up[field] = value;
    const res = await fetchAPI('admin/edit_user', 'POST', up);
    if (res) toast('تم التحديث بنجاح');
    else loadUsers();
}

async function loadServices() {
    const data = await fetchAPI('admin/services');
    if (data) {
        const tbody = document.getElementById('srv-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.services.forEach((s, i) => {
            const fields = s.fields || {};
            tbody.innerHTML += `<tr>
                <td class="text-slate-500">${i + 1}</td>
                <td class="font-mono text-xs text-blue-400">${s.service_code || '-'}</td>
                <td class="font-bold text-white flex items-center gap-2">
                    ${fields.image_url ? `<img src="${fields.image_url}" class="w-6 h-6 rounded-md object-contain">` : '<div class="w-6 h-6 bg-slate-700 rounded-md flex items-center justify-center"><i data-lucide="image" class="w-3 h-3 text-slate-500"></i></div>'}
                    ${s.name}
                </td>
                <td class="text-blue-300 text-[10px] font-bold">${s.company}</td>
                <td class="font-black text-emerald-400 font-mono text-xs">${s.price}</td>
                <td class="text-slate-400 font-mono text-xs">${fields.cost || '-'}</td>
                <td class="text-amber-500 font-mono text-xs">${fields.commission || '-'}</td>
                <td>${s.is_active ? '<span class="text-emerald-400 text-[10px] font-bold">نشط</span>' : '<span class="text-red-400 text-[10px] font-bold">معطل</span>'}</td>
                <td>
                    <div class="flex gap-2">
                        <button onclick='editSrv(${JSON.stringify(s)})' class="bg-slate-700 p-2 rounded-lg hover:bg-blue-600 transition"><i data-lucide="edit" class="w-4 h-4 text-slate-300"></i></button>
                        <button onclick="delSrv('${s.id}')" class="bg-slate-700 p-2 rounded-lg hover:bg-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4 text-slate-300"></i></button>
                    </div>
                </td>
            </tr>`;
        });
        lucide.createIcons();
    }
}

async function loadDeposits() {
    const data = await fetchAPI('admin/deposits');
    if (data) {
        const t = document.getElementById('req-table');
        if(!t) return;
        t.innerHTML = '';
        data.requests.forEach(r => {
            t.innerHTML += `<tr><td class="text-[10px] text-slate-400 font-mono">${new Date(r.created_at).toLocaleString('ar-EG')}</td><td class="font-bold text-white">${r.custom_users?.name || 'مُحذف'}<br><span class="text-[10px] text-slate-400">${r.custom_users?.phone || ''}</span></td><td>${r.deposit_methods?.name || '-'}</td><td class="font-black text-yellow-400">${r.amount}</td><td class="font-mono text-xs">${r.transfer_ref || '-'}</td>
            <td>${r.transfer_image ? `<img src="${r.transfer_image}" onclick="openImgPreview('${r.transfer_image}')" class="w-8 h-8 rounded border border-slate-600 cursor-pointer object-cover">` : '-'}</td>
            <td>${r.status === 'pending' ? '<span class="text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded text-[10px] font-bold border border-yellow-500/20">قيد الانتظار</span>' : (r.status === 'approved' ? '<span class="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-[10px] font-bold">مكتمل</span>' : '<span class="text-red-400 bg-red-500/10 px-2 py-1 rounded text-[10px] font-bold">مرفوض</span>')}</td>
            <td>${r.status === 'pending' ? `<button onclick="updateReq('${r.id}','approved')" class="bg-emerald-600 text-white p-1 rounded hover:bg-emerald-500 mb-1 text-[10px] w-full">قبول</button><button onclick="updateReq('${r.id}','rejected')" class="bg-red-600 text-white p-1 rounded hover:bg-red-500 text-[10px] w-full">رفض</button>` : '-'}</td></tr>`;
        });
    }
}

async function updateReq(id, status) {
    if (!confirm(`هل أنت متأكد من ${status === 'approved' ? 'القبول' : 'الرفض'}؟`)) return;
    const res = await fetchAPI('admin/deposits', 'POST', { id, status });
    if (res) { toast('تمت المعالجة'); loadDeposits(); }
}

async function loadTransactions() {
    const data = await fetchAPI('admin/transactions');
    if (data) {
        const t = document.getElementById('tx-table');
        if(!t) return;
        t.innerHTML = '';
        data.transactions.forEach(r => {
            t.innerHTML += `<tr><td class="font-mono text-blue-400 font-bold">${r.invoice_no}</td><td class="text-[10px] text-slate-400 font-mono">${new Date(r.created_at).toLocaleString('ar-EG')}</td>
            <td class="font-bold text-white">${r.service_name}</td><td class="text-slate-300 text-sm">${r.user_id ? 'تاجر' : '-'}</td><td class="font-mono text-slate-300">${r.customer_phone || '-'}</td><td class="font-black text-emerald-400 font-mono">${r.total}</td>
            <td><span class="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold">تم الدفع</span></td></tr>`;
        });
    }
}

async function loadSettings() {
    const data = await fetchAPI('admin/settings');
    if (data && data.settings) {
        document.getElementById('set-name').value = data.settings.system_name || 'Dr Pay';
        document.getElementById('set-curr').value = data.settings.currency || 'ج.م';
        document.getElementById('set-fees').value = data.settings.fees_percentage || 0;
    }
}

async function loadMethods() {
    const data = await fetchAPI('admin/deposit_methods');
    if (data) {
        const tbody = document.getElementById('meth-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.methods.forEach(m => {
            tbody.innerHTML += `<tr><td class="font-bold text-white">${m.name}</td><td class="text-blue-300 font-mono">${m.account_number}</td><td class="text-xs text-slate-400">${m.details || '-'}</td>
            <td>${m.is_active ? '<span class="text-emerald-400">مفعل</span>' : '<span class="text-red-400">معطل</span>'}</td>
            <td>
                <div class="flex gap-2">
                <button onclick="editMeth('${m.id}','${m.name}','${m.account_number}','${m.details || ''}')" class="bg-slate-700 p-2 rounded-lg hover:bg-blue-600 text-slate-300"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button onclick="delMeth('${m.id}')" class="bg-slate-700 p-2 rounded-lg hover:bg-red-600 text-slate-300"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </td></tr>`;
        });
        lucide.createIcons();
    }
}

async function resetDevices(id) {
    if (!confirm('هل تريد تصفير الأجهزة المسجلة لهذا المستخدم؟')) return;
    const res = await fetchAPI('admin/reset_devices', 'POST', { user_id: id });
    if (res) toast('تم تصفير الأجهزة بنجاح');
}

async function changePass(id) {
    const newPass = prompt('أدخل كلمة المرور الجديدة:');
    if (!newPass) return;
    const res = await fetchAPI('admin/edit_user', 'POST', { id, password: newPass });
    if (res) toast('تم تغيير كلمة المرور بنجاح');
}

function openNotifModal(uid) {
    document.getElementById('notif-target-id').value = uid;
    openModal('notif');
}

document.getElementById('notif-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetchAPI('admin/send_notification', 'POST', {
        user_id: document.getElementById('notif-target-id').value,
        title: document.getElementById('notif-title').value,
        message: document.getElementById('notif-msg').value
    });
    if (res) { toast('تم إرسال التنبيه بنجاح'); closeModal('notif'); document.getElementById('notif-form').reset(); }
});

function openUserDetails(u) {
    const wallet = u.wallets && u.wallets.length ? u.wallets[0] : { balance: 0, golden_points: 0, credit_limit: 0 };
    const infoDiv = document.getElementById('full-user-info');
    if(!infoDiv) return;
    infoDiv.innerHTML = `
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">الاسم الرباعي</label>
            <p class="text-sm font-bold text-white">${u.name}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">رقم الموبيل</label>
            <p class="text-sm font-bold text-blue-400 font-mono">${u.phone}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">اسم المحل</label>
            <p class="text-sm font-bold text-white">${u.shop_name || '-'}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">المحافظة</label>
            <p class="text-sm font-bold text-white">${u.province || '-'}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl col-span-2">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">العنوان التفصيلي</label>
            <p class="text-sm font-bold text-slate-300">${u.address || 'لم يتم تسجيل عنوان'}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">الرقم القومي</label>
            <p class="text-sm font-bold text-emerald-400 font-mono tracking-tighter">${u.national_id || '-'}</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-2xl">
            <label class="block text-[8px] text-slate-500 mb-1 font-black">الدور / الصلاحية</label>
            <p class="text-sm font-bold text-yellow-500">${u.role}</p>
        </div>
    `;
    document.getElementById('det-bal').textContent = wallet.balance.toFixed(2);
    document.getElementById('det-pts').textContent = wallet.golden_points || 0;
    document.getElementById('det-crd').textContent = wallet.credit_limit || 0;

    // Inject Max Devices Control
    const ctrl = document.createElement('div');
    ctrl.className = 'col-span-2 mt-4 pt-4 border-t border-white/5 space-y-4';
    ctrl.innerHTML = `
        <div class="flex items-center justify-between">
            <label class="text-[10px] text-slate-500 font-black uppercase">عدد الأجهزة المسموح بها</label>
            <div class="flex items-center gap-2">
                 <input type="number" id="det-max-dev" value="${u.max_devices || 2}" class="w-16 bg-slate-900 border-none rounded-lg p-2 text-center text-blue-400 font-black">
                 <button onclick="updateMaxDev('${u.id}')" class="bg-blue-600 px-3 py-2 rounded-lg text-[10px] font-black hover:bg-blue-500 transition">تحديث</button>
            </div>
        </div>
    `;
    infoDiv.appendChild(ctrl);
    openModal('user-details');
}

async function updateMaxDev(uid) {
    const max = document.getElementById('det-max-dev').value;
    const res = await fetchAPI('admin/update_user_device_limit', 'POST', { user_id: uid, max_devices: max });
    if (res) { toast('تم تحديث عدد الأجهزة'); loadUsers(); }
}

function openWalletEdit(uid, pts, crd) {
    document.getElementById('wallet-target-id').value = uid;
    document.getElementById('wallet-points').value = pts;
    document.getElementById('wallet-credit').value = crd;
    openModal('wallet');
}

document.getElementById('wallet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetchAPI('admin/edit_wallet', 'POST', {
        user_id: document.getElementById('wallet-target-id').value,
        golden_points: document.getElementById('wallet-points').value,
        credit_limit: document.getElementById('wallet-credit').value
    });
    if (res) { toast('تم تحديث المحفظة'); closeModal('wallet'); loadUsers(); }
});

// ===== CATEGORIES =====
async function loadCategories() {
    const data = await fetchAPI('admin/categories');
    if (data) {
        const tbody = document.getElementById('cat-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.categories.forEach(c => {
            tbody.innerHTML += `<tr><td class="font-bold text-white">${c.name}</td><td><i data-lucide="${c.icon || 'layout-grid'}" class="w-4 h-4 text-slate-400"></i></td>
            <td><div class="flex gap-2">
                <button onclick="editCat('${c.id}','${c.name}','${c.icon || ''}')" class="bg-slate-700 p-1.5 rounded text-blue-300 hover:text-white transition"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                <button onclick="delCat('${c.id}')" class="bg-slate-700 p-1.5 rounded text-red-400 hover:text-white transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div></td></tr>`;
        });
        lucide.createIcons();
    }
}
document.getElementById('cat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const res = await fetchAPI('admin/categories', 'POST', { id, name: document.getElementById('cat-name').value, icon: document.getElementById('cat-icon').value });
    if (res) { toast('تم حفظ القسم'); document.getElementById('cat-form').reset(); document.getElementById('cat-id').value = ''; loadCategories(); }
});
function editCat(id, n, i) { document.getElementById('cat-id').value = id; document.getElementById('cat-name').value = n; document.getElementById('cat-icon').value = i; }
async function delCat(id) { if (confirm('هل تريد حذف هذا القسم؟')) { await fetchAPI('admin/categories', 'DELETE', { id }); loadCategories(); } }

// ===== CARDS =====
async function loadCards() {
    const data = await fetchAPI('admin/cards');
    if (data) {
        const tbody = document.getElementById('card-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.cards.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.category}</td><td class="font-bold text-emerald-400">${c.denomination}</td><td class="font-mono text-xs">${c.code}</td><td class="text-[9px] text-slate-500">${c.serial_number || '-'}</td>
            <td>${c.is_sold ? '<span class="text-red-400">مباع</span>' : '<span class="text-emerald-400">متاح</span>'}</td>
            <td class="text-[9px] text-slate-500">${c.sold_at ? new Date(c.sold_at).toLocaleString('ar-EG') : '-'}</td></tr>`;
        });
    }
}
document.getElementById('card-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetchAPI('admin/cards', 'POST', { category: document.getElementById('card-cat').value, denomination: document.getElementById('card-den').value, codes: document.getElementById('card-codes').value });
    if (res) { toast('تم إضافة الأكواد بنجاح'); document.getElementById('card-form').reset(); loadCards(); }
});

document.getElementById('add-bal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetchAPI('admin/balance', 'POST', { user_id: document.getElementById('add-bal-uid').value, amount: document.getElementById('add-bal-amount').value, type: 'add' });
    if (res) { toast('تم شحن الرصيد بنجاح'); closeModal('balance'); loadUsers(); }
});

document.getElementById('srv-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('srv-id').value;
    const payload = {
        name: document.getElementById('srv-name').value,
        price: Number(document.getElementById('srv-price').value),
        company: document.getElementById('srv-company').value,
        service_code: document.getElementById('srv-code').value,
        is_active: document.getElementById('srv-active').checked,
        fields: {
            cost: Number(document.getElementById('srv-cost').value || 0),
            commission: Number(document.getElementById('srv-com').value || 0),
            image_url: document.getElementById('srv-image').value,
            shortcuts: document.getElementById('srv-shortcuts').value
        }
    };
    if (id) payload.id = id;
    const res = await fetchAPI('admin/services', 'POST', payload);
    if (res) {
        toast('تم حفظ الخدمة بنجاح!');
        document.getElementById('srv-form').reset();
        document.getElementById('srv-id').value = '';
        loadServices();
    }
});

function editSrv(s) {
    document.getElementById('srv-id').value = s.id;
    document.getElementById('srv-name').value = s.name;
    document.getElementById('srv-code').value = s.service_code || '';
    document.getElementById('srv-price').value = s.price;
    document.getElementById('srv-company').value = s.company;
    document.getElementById('srv-active').checked = s.is_active;
    const f = s.fields || {};
    document.getElementById('srv-cost').value = f.cost || '';
    document.getElementById('srv-com').value = f.commission || '';
    document.getElementById('srv-image').value = f.image_url || '';
    document.getElementById('srv-shortcuts').value = f.shortcuts || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('set-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetchAPI('admin/settings', 'POST', { settings: { system_name: document.getElementById('set-name').value, currency: document.getElementById('set-curr').value, fees_percentage: document.getElementById('set-fees').value } });
    toast('تم تحديث إعدادات النظام المحورية بنجاح');
});

document.getElementById('meth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('meth-id').value;
    const res = await fetchAPI('admin/deposit_methods', 'POST', {
        id, name: document.getElementById('meth-name').value, account_number: document.getElementById('meth-acc').value, details: document.getElementById('meth-det').value, is_active: true
    });
    if (res) { toast('تم الحفظ بنجاح'); document.getElementById('meth-form').reset(); document.getElementById('meth-id').value = ''; loadMethods(); }
});

function editMeth(id, n, a, d) { document.getElementById('meth-id').value = id; document.getElementById('meth-name').value = n; document.getElementById('meth-acc').value = a; document.getElementById('meth-det').value = d; }
async function delMeth(id) { if (confirm('هل أنت متأكد من مسح وسيلة الدفع؟')) { await fetchAPI('admin/deposit_methods', 'DELETE', { id }); loadMethods(); } }

async function delSrv(id) { if (confirm('هل تريد مسح الخدمة نهائياً من النظام؟')) { const r = await fetchAPI('admin/services', 'DELETE', { id }); if (r) { toast('تم المسح'); loadServices(); } } }

function openModal(id, targetId = null) {
    if (targetId) {
        if(id === 'balance') {
            document.getElementById('add-bal-uid').value = targetId;
            document.getElementById('add-bal-amount').value = '';
        }
    }
    const modal = document.getElementById(id + '-modal');
    const card = document.getElementById(id + '-card');
    if(!modal || !card) return;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); card.classList.remove('scale-95'); }, 10);
}
function closeModal(id) {
    const modal = document.getElementById(id + '-modal');
    const card = document.getElementById(id + '-card');
    if(!modal || !card) return;
    card.classList.add('scale-95'); modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// ===== BRANCHES =====
async function loadBranches() {
    const data = await fetchAPI('admin/branches');
    if (data) {
        const tbody = document.getElementById('branches-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.branches.forEach(b => {
            tbody.innerHTML += `<tr><td class="font-bold text-white">${b.name}</td><td class="text-slate-300 text-sm">${b.location || '-'}</td><td class="text-[10px] text-slate-400 font-mono">${new Date(b.created_at).toLocaleString('ar-EG')}</td>
            <td><div class="flex gap-2"><button onclick="editBranch('${b.id}','${b.name}','${b.location || ''}')" class="bg-slate-700 p-2 rounded-lg hover:bg-blue-600 text-slate-300"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="delBranch('${b.id}')" class="bg-slate-700 p-2 rounded-lg hover:bg-red-600 text-slate-300"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>`;
        });
        lucide.createIcons();
    }
}
document.getElementById('branch-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('branch-id').value;
    const res = await fetchAPI('admin/branches', 'POST', { id, name: document.getElementById('branch-name').value, location: document.getElementById('branch-location').value });
    if (res) { toast('تم حفظ الفرع'); document.getElementById('branch-form').reset(); document.getElementById('branch-id').value = ''; loadBranches(); }
});
function editBranch(id, n, l) { document.getElementById('branch-id').value = id; document.getElementById('branch-name').value = n; document.getElementById('branch-location').value = l; }
async function delBranch(id) { if (confirm('هل تريد حذف هذا الفرع؟')) { await fetchAPI('admin/branches', 'DELETE', { id }); loadBranches(); } }

// ===== EMPLOYEES =====
async function loadEmployees() {
    const bData = await fetchAPI('admin/branches');
    if (bData) {
        const sel = document.getElementById('emp-branch');
        if(sel) {
            sel.innerHTML = '<option value="">-- بدون فرع --</option>';
            bData.branches.forEach(b => sel.innerHTML += `<option value="${b.id}">${b.name}</option>`);
        }
    }
    const data = await fetchAPI('admin/employees');
    if (data) {
        const tbody = document.getElementById('emp-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.employees.forEach(e => {
            const branchName = e.branches ? e.branches.name : '-';
            tbody.innerHTML += `<tr><td class="font-bold text-white">${e.name}</td><td class="text-slate-300 font-mono">${e.phone}</td><td class="text-blue-300 text-xs">${branchName}</td><td class="text-slate-400 text-xs">${e.role}</td>
            <td><div class="flex gap-2"><button onclick="editEmp('${e.id}','${e.name}','${e.phone}','${e.branch_id || ''}')" class="bg-slate-700 p-2 rounded-lg hover:bg-blue-600 text-slate-300"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="delEmp('${e.id}')" class="bg-slate-700 p-2 rounded-lg hover:bg-red-600 text-slate-300"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td></tr>`;
        });
        lucide.createIcons();
    }
}
document.getElementById('emp-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('emp-id').value;
    const res = await fetchAPI('admin/employees', 'POST', { id, name: document.getElementById('emp-name').value, phone: document.getElementById('emp-phone').value, branch_id: document.getElementById('emp-branch').value || null, role: 'employee' });
    if (res) { toast('تم حفظ الموظف'); document.getElementById('emp-form').reset(); document.getElementById('emp-id').value = ''; loadEmployees(); }
});
function editEmp(id, n, p, b) { document.getElementById('emp-id').value = id; document.getElementById('emp-name').value = n; document.getElementById('emp-phone').value = p; document.getElementById('emp-branch').value = b; }
async function delEmp(id) { if (confirm('هل تريد حذف هذا الموظف؟')) { await fetchAPI('admin/employees', 'DELETE', { id }); loadEmployees(); } }

// ===== FULL LOGS =====
async function loadFullLogs() {
    const data = await fetchAPI('logs');
    if (data) {
        const tbody = document.getElementById('full-logs-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.logs.forEach(l => {
            const un = l.custom_users ? l.custom_users.name : 'محذوف';
            tbody.innerHTML += `<tr><td class="text-[10px] text-slate-400 font-mono">${new Date(l.created_at).toLocaleString('ar-EG')}</td><td class="font-bold text-blue-300">${un}</td><td class="text-xs text-slate-300 bg-slate-800 rounded px-2 text-center">${l.action}</td><td class="text-slate-300 text-xs">${l.details || '-'}</td></tr>`;
        });
    }
}

function openImgPreview(src) {
    const modal = document.getElementById('img-preview-modal');
    const img = document.getElementById('img-preview-src');
    if(!modal || !img) return;
    img.src = src;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}
function closeImgPreview() {
    const modal = document.getElementById('img-preview-modal');
    if(!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// ===== TICKETS =====
async function loadTickets() {
    const data = await fetchAPI('admin/tickets');
    if (data) {
        const tbody = document.getElementById('tickets-table');
        if(!tbody) return;
        tbody.innerHTML = '';
        data.tickets.forEach(t => {
            const statusClass = t.status === 'open' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : (t.status === 'closed' ? 'text-slate-500 bg-slate-500/10 border-slate-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20');
            tbody.innerHTML += `<tr>
                <td class="font-mono text-xs">#${t.id.slice(0,8)}</td>
                <td class="font-bold text-white">${t.custom_users?.name || 'مُحذف'}</td>
                <td class="text-sm text-slate-300">${t.subject}</td>
                <td><span class="text-[10px] font-bold px-2 py-1 rounded border ${t.priority === 'high' ? 'text-red-400 border-red-500/20' : 'text-slate-400 border-slate-700'}">${t.priority}</span></td>
                <td><span class="text-[10px] font-bold px-2 py-1 rounded border ${statusClass}">${t.status}</span></td>
                <td class="text-[10px] text-slate-400 font-mono">${new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                <td>
                    <div class="flex gap-2">
                        <button onclick="viewTicket('${t.id}')" class="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-500 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <select onchange="updateTicketStatus('${t.id}', this.value)" class="bg-slate-800 border-slate-700 text-xs rounded p-1 text-slate-300">
                            <option value="open" ${t.status === 'open' ? 'selected' : ''}>مفتوحة</option>
                            <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>قيد المعالجة</option>
                            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>مغلقة</option>
                        </select>
                    </div>
                </td>
            </tr>`;
        });
        lucide.createIcons();
    }
}

async function updateTicketStatus(id, status) {
    const res = await fetchAPI('admin/tickets', 'POST', { id, status });
    if (res) { toast('تم تحديث حالة التذكرة'); loadTickets(); }
}

async function viewTicket(id) {
    // Basic alert for now, could be a modal
    const data = await fetchAPI(`admin/tickets?id=${id}`);
    if (data && data.ticket) {
        alert(`الموضوع: ${data.ticket.subject}\n\nالرسالة:\n${data.ticket.message}`);
    }
}

function logout() { localStorage.removeItem('drpay_user'); localStorage.removeItem('drpay_token'); window.location.href = 'login.html'; }

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    refreshData();
    const dt = document.getElementById('current-date');
    if(dt) dt.textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});
