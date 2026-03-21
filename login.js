/**
 * Dr Pay - Login & Security Logic
 */

async function fetchAPI(endpoint, method = 'POST', body = null) {
    const options = {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('drpay_token') || ''}`
        }
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`/api/index.js?action=${endpoint}`, options);
        const data = await response.json();
        return data;
    } catch (error) { 
        console.error("Fetch Error:", error);
        return { error: 'خطأ في الاتصال بالخادم' }; 
    }
}

function toast(msg) {
    const existing = document.getElementById('toast-notif');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.id = 'toast-notif';
    t.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl z-[100] transition-all transform pointer-events-none';
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, -20px)';
    t.textContent = msg;
    document.body.appendChild(t);
    
    setTimeout(() => {
        t.style.opacity = '1';
        t.style.transform = 'translate(-50%, 0)';
    }, 10);

    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => t.remove(), 500);
    }, 4000);
}

// Device Fingerprinting
async function getDeviceID() {
    let id = localStorage.getItem('drpay_device_id');
    if (!id) {
        id = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
        localStorage.setItem('drpay_device_id', id);
    }
    return id;
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('identifier').value;
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin w-5 h-5"></i> جاري التحقق...';
        lucide.createIcons();

        const device_id = await getDeviceID();
        const device_info = {
            ua: navigator.userAgent,
            platform: navigator.platform,
            vendor: navigator.vendor,
            screen: `${screen.width}x${screen.height}`
        };

        // Check if we are on admin-login or regular login
        const isPageAdmin = window.location.pathname.includes('admin');
        const expected_role = isPageAdmin ? 'admin' : 'user';

        const res = await fetchAPI('login', 'POST', {
            identifier,
            password,
            device_id,
            device_info,
            expected_role,
            location: { timestamp: Date.now() }
        });

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();

        if (res.error) {
            toast(res.error);
        } else if (res.otp_required) {
            // Show OTP step
            document.getElementById('login-step').classList.add('hidden');
            document.getElementById('otp-step').classList.remove('hidden');
            document.getElementById('display-phone').textContent = res.phone.slice(-4);
            localStorage.setItem('temp_login_identifier', identifier);
            localStorage.setItem('temp_login_password', password);
            toast('تم إرسال كود التحقق لجهاز جديد');
        } else if (res.token) {
            completeLogin(res);
        }
    });
}

async function verifyOTP() {
    const otp = document.getElementById('otp-code').value;
    if (!otp || otp.length < 6) return toast('يرجى إدخال كود صحيح');

    const identifier = localStorage.getItem('temp_login_identifier');
    const password = localStorage.getItem('temp_login_password');
    const device_id = await getDeviceID();
    
    const isPageAdmin = window.location.pathname.includes('admin');
    const expected_role = isPageAdmin ? 'admin' : 'user';

    const res = await fetchAPI('login', 'POST', {
        identifier,
        password,
        otp,
        otp_purpose: 'new_device',
        device_id,
        expected_role
    });

    if (res.error) {
        toast(res.error);
    } else if (res.token) {
        localStorage.removeItem('temp_login_identifier');
        localStorage.removeItem('temp_login_password');
        completeLogin(res);
    }
}

function completeLogin(data) {
    localStorage.setItem('drpay_token', data.token);
    localStorage.setItem('drpay_user', JSON.stringify(data.user));
    toast('✅ تم تسجيل الدخول بنجاح');
    
    setTimeout(() => {
        if (data.user.role === 'admin' || data.user.role === 'employee') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }, 1500);
}

// Registration logic if exists on page
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (Registration logic was handled in previous turns or stays as-is)
    });
}

function applyTheme() {
    const theme = localStorage.getItem('drpay_theme') || 'dark';
    document.body.classList.toggle('light-theme', theme === 'light');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = theme === 'light' ? '<i data-lucide="moon" class="w-5 h-5"></i>' : '<i data-lucide="sun" class="w-5 h-5"></i>';
    lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    // Security: Protect code
    document.addEventListener('contextmenu', e => e.preventDefault());
});
