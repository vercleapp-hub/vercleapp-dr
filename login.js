/**
 * Dr Pay - Login & OTP Verification Logic
 */

async function fetchAPI(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`/api/index.js?action=${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            toast(data.error || 'خطأ في العملية');
            return null;
        }
        return data;
    } catch (error) { return null; }
}

function toast(msg) {
    const t = document.createElement('div');
    t.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-50 transition-all transform translate-y-10 opacity-0';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.remove('translate-y-10', 'opacity-0'); }, 10);
    setTimeout(() => { t.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone').value;
    const pass = document.getElementById('password').value;
    const btn = e.target.querySelector('button');
    const original = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="animate-spin w-5 h-5"></i> جاري التحقق...';
    lucide.createIcons();

    const fp = await getFingerprint();
    const res = await fetchAPI('login', 'POST', { phone, password: pass, fingerprint: fp });
    
    btn.disabled = false;
    btn.innerHTML = original;
    lucide.createIcons();

    if (res && res.requires_otp) {
        document.getElementById('login-step').classList.add('hidden');
        document.getElementById('otp-step').classList.remove('hidden');
        document.getElementById('phone-display').textContent = phone.slice(-4);
        toast('تم إرسال كود التحقق بنجاح');
    } else if (res && res.token) {
        saveLogin(res);
    }
});

async function verifyOTP() {
    const phone = document.getElementById('phone').value;
    const code = document.getElementById('otp-code').value;
    const fp = await getFingerprint();
    const res = await fetchAPI('verify_otp', 'POST', { phone, code, fingerprint: fp });
    if (res && res.token) {
        saveLogin(res);
    }
}

function saveLogin(data) {
    localStorage.setItem('drpay_token', data.token);
    localStorage.setItem('drpay_user', JSON.stringify(data.user));
    localStorage.setItem('drpay_fp', data.user.last_fingerprint);
    toast('🎉 تم تسجيل الدخول بنجاح');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
}

async function getFingerprint() {
    let fp = localStorage.getItem('drpay_fp');
    if (!fp) {
        fp = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('drpay_fp', fp);
    }
    return fp;
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('drpay_theme', isLight ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const isLight = localStorage.getItem('drpay_theme') === 'light';
    document.body.classList.toggle('light-theme', isLight);
    lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    if (localStorage.getItem('drpay_token')) window.location.href = 'index.html';
});
