import { supabase } from './supabase.js';

window.addEventListener('DOMContentLoaded', () => {
    checkUser();
    
    document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
});

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    
    if (session) {
        if(loginSection) loginSection.classList.add('hidden');
        if(dashboardSection) dashboardSection.classList.remove('hidden');
        fetchUserProfile(session.user.id);
    } else {
        if(loginSection) loginSection.classList.remove('hidden');
        if(dashboardSection) dashboardSection.classList.add('hidden');
    }
}

async function fetchUserProfile(userId) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
    if (profile) {
        document.getElementById('user-name-display').textContent = profile.full_name;
        document.getElementById('user-balance-display').textContent = parseFloat(profile.balance).toFixed(2);
        
        if(profile.role === 'ADMIN') {
            document.getElementById('admin-link').classList.remove('hidden');
            document.getElementById('user-role-badge').textContent = 'ADMIN';
            document.getElementById('user-role-badge').classList.add('bg-purple-600');
        } else {
            document.getElementById('admin-link').classList.add('hidden');
            document.getElementById('user-role-badge').textContent = 'USER';
            document.getElementById('user-role-badge').classList.add('bg-blue-600');
        }
        
        loadServices();
        loadTransactions(userId);
    }
}

async function loadServices() {
    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
    const container = document.getElementById('services-container');
    if(!container) return;
    
    container.innerHTML = '';
    if(!services || services.length === 0) {
        container.innerHTML = '<p class="text-slate-400 col-span-full">لا توجد خدمات متاحة حالياً.</p>';
        return;
    }
    
    services.forEach(service => {
        const card = document.createElement('div');
        card.className = "glass-card p-6 rounded-2xl flex flex-col justify-between items-start gap-4 fade-in";
        card.innerHTML = `
            <div class="w-full text-right">
                <span class="inline-block px-3 py-1 bg-brand-500/20 text-brand-400 rounded-full text-xs mb-3 font-semibold">خدمة</span>
                <h3 class="text-xl font-bold text-white mb-2">${service.name}</h3>
                <p class="text-sm text-slate-400 mb-4 line-clamp-2">${service.description || ''}</p>
                <div class="text-2xl font-bold text-emerald-400">${parseFloat(service.price).toFixed(2)} ج.م</div>
            </div>
            <button onclick="openServiceModal('${service.id}')" class="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                اطلب الآن
            </button>
        `;
        container.appendChild(card);
    });
    window.allServices = services;
}

window.openServiceModal = function(serviceId) {
    const service = window.allServices.find(s => s.id === serviceId);
    if(!service) return;
    
    const container = document.getElementById('modal-content-container');
    const body = document.getElementById('modal-body');
    const backdrop = document.getElementById('modal-backdrop');
    
    let fieldsHtml = '';
    if(service.dynamic_fields && service.dynamic_fields.length > 0) {
        service.dynamic_fields.forEach(f => {
            fieldsHtml += `
                <div class="mb-4 text-right">
                    <label class="block text-sm font-medium text-slate-300 mb-1">${f.name}</label>
                    <input type="text" id="dyn-field-${f.name}" required class="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none" placeholder="أدخل ${f.name}">
                </div>
            `;
        });
    }

    body.innerHTML = `
        <div class="text-right">
            <h3 class="text-2xl font-bold text-white mb-2">${service.name}</h3>
            <p class="text-slate-400 mb-6">${service.description || ''}</p>
        </div>
        <form id="payment-form">
            ${fieldsHtml}
            <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6 flex justify-between items-center flex-row-reverse">
                <span class="text-2xl font-bold text-emerald-400">${parseFloat(service.price).toFixed(2)} ج.م</span>
                <span class="text-slate-300">التكلفة الإجمالية:</span>
            </div>
            <button type="submit" id="pay-btn" class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                تأكيد العملية والدفع
            </button>
        </form>
    `;

    backdrop.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        container.classList.remove('scale-95');
    }, 10);

    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('pay-btn');
        btn.disabled = true;
        btn.textContent = 'جاري التنفيذ...';

        const currentBalance = parseFloat(document.getElementById('user-balance-display').textContent);
        const price = parseFloat(service.price);
        
        if (currentBalance < price) {
            alert('عفواً، رصيدك غير كافٍ. يرجى شحن الرصيد من الإدارة.');
            btn.disabled = false;
            btn.textContent = 'تأكيد العملية والدفع';
            return;
        }

        let userInputs = {};
        if(service.dynamic_fields) {
            service.dynamic_fields.forEach(f => {
                userInputs[f.name] = document.getElementById(`dyn-field-${f.name}`).value;
            });
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        const { error: txError } = await supabase.from('transactions').insert({
            user_id: session.user.id,
            service_id: service.id,
            amount: price,
            service_name: service.name,
            user_inputs: userInputs,
            status: 'PENDING'
        });

        if (txError) {
            alert('خطأ أثناء التنفيذ: ' + txError.message);
            btn.disabled = false;
            return;
        }

        const newBalance = currentBalance - price;
        await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);

        document.getElementById('user-balance-display').textContent = newBalance.toFixed(2);
        alert('تم تنفيذ طلبك وسيتم مراجعته قريباً!');
        
        closeModal();
        loadTransactions(session.user.id);
        
        // WhatsApp Integration Simulation
        const waMsg = `طلب جديد لخدمة: ${service.name} بقيمة ${price} ج.م`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
        window.open(waUrl, '_blank');
    });
};

function closeModal() {
    const container = document.getElementById('modal-content-container');
    const backdrop = document.getElementById('modal-backdrop');
    
    backdrop.classList.add('opacity-0');
    container.classList.add('scale-95');
    setTimeout(() => { backdrop.classList.add('hidden'); }, 300);
}

async function loadTransactions(userId) {
    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    const tbody = document.getElementById('transactions-body');
    if(!tbody) return;
    
    if(error || !txs || txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">لا توجد عمليات.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    txs.forEach(tx => {
        let statusHtml = '';
        if(tx.status === 'PENDING') statusHtml = '<span class="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-xs font-semibold">مراجعة</span>';
        else if(tx.status === 'COMPLETED') statusHtml = '<span class="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-semibold">مكتمل</span>';
        else statusHtml = '<span class="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-semibold">مرفوض</span>';
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors border-b border-slate-700/50 last:border-0';
        const date = new Date(tx.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        tr.innerHTML = `
            <td class="py-4 px-6">${tx.service_name}</td>
            <td class="py-4 px-6 font-bold text-white">${parseFloat(tx.amount).toFixed(2)}</td>
            <td class="py-4 px-6 text-slate-400 text-sm" dir="ltr">${date}</td>
            <td class="py-4 px-6">${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
};
