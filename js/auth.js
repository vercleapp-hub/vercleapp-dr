import { supabase } from './supabase.js';

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const nameField = document.getElementById('name-field');
    const submitBtn = document.getElementById('auth-submit-btn');
    const title = document.querySelector('#login-section h1');
    const subtitle = document.querySelector('#login-section p');
    
    // Toggle Login/Register
    if(toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            if(isLoginMode) {
                nameField.classList.add('hidden');
                document.getElementById('full-name').removeAttribute('required');
                submitBtn.textContent = 'تسجيل الدخول';
                title.textContent = 'Dr Pay';
                subtitle.textContent = 'سجل الدخول للمتابعة إلى حسابك';
                toggleBtn.textContent = 'ليس لديك حساب؟ إنشاء حساب جديد';
            } else {
                nameField.classList.remove('hidden');
                document.getElementById('full-name').setAttribute('required', 'true');
                submitBtn.textContent = 'إنشاء حساب جديد';
                title.textContent = 'حساب جديد';
                subtitle.textContent = 'انضم إلينا الآن للبدء باستخدام خدماتنا';
                toggleBtn.textContent = 'لديك حساب بالفعل؟ تسجيل الدخول';
            }
        });
    }

    const form = document.getElementById('auth-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('auth-error');
            
            errorDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="flex items-center justify-center gap-2">جاري المعالجة...</span>';
            
            try {
                if(isLoginMode) {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });
                    if(error) throw error;
                    window.location.reload();
                } else {
                    const fullName = document.getElementById('full-name').value;
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                full_name: fullName,
                                role: 'USER'
                            }
                        }
                    });
                    if(error) throw error;
                    
                    alert('تم إنشاء الحساب بنجاح. يتم تسجيل دخولك...');
                    window.location.reload();
                }
            } catch(err) {
                // Formatting common errors in Arabic
                if(err.message.includes('Invalid login credentials')) {
                    errorDiv.textContent = 'بيانات الدخول غير صحيحة';
                } else if(err.message.includes('User already registered')) {
                     errorDiv.textContent = 'البريد الإلكتروني مسجل بالفعل';
                } else {
                    errorDiv.textContent = err.message;
                }
                errorDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
            }
        });
    }
});
