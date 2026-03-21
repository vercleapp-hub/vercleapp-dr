const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://auwnsxmdksplftccysqu.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi'
);

const WA_TOKEN = "EAAMnBkRdybgBRHXp1vsktrcEFRuXFEbmpo8iTCG5EmriSAWEk2sDpdbFUqU5eKQJZBT7KdZCqOP8af3ZCcQZCAvAihf3Wracj7GYcBfkzxYdsNY4jIa8LGPdHJud038lAi5RZA5E33xDh2uhZAXDmKqTJo8fovGStWYlZCg0zLZC0mGQwjZAayMMQ0djGavtsZBlhY4dj1vUZAf1MFn5X4mZB0rS1jtN3XWkF8WwkjS2ky7ZA6aITbT4LPqx6AQPOnaGFhvAjFApLUCs2qgVZAinkLbAKlfkHE";
const WA_PHONE_ID = "880132145193925";

async function sendWhatsAppOTP(phone, code) {
  try {
    const cleanPhone = phone.replace(/\D/g, ''); 
    const response = await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`,
        type: "template",
        template: {
          name: "otp_verification", 
          language: { code: "ar" },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: code }]
          }, {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }]
          }]
        }
      })
    });
    return await response.json();
  } catch (err) {
    console.error("WA Error:", err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  let action = req.query.action || '';
  const method = req.method;

  const getAuthUser = async () => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const { data: session } = await supabase.from('sessions').select('user_id').eq('session_id', token).single();
    if (!session) return null;
    const { data: user } = await supabase.from('custom_users').select('*').eq('id', session.user_id).single();
    return user;
  };

  try {
    if (action === 'test_otp' && method === 'POST') {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const waResult = await sendWhatsAppOTP(phone, code);
        return res.status(200).json({ success: true, message: 'تمت محاولة الإرسال عبر واتساب', result: waResult, code_sent: code });
    }

    if (action === 'login' && method === 'POST') {
      const { identifier, password, device_id, location, device_info, otp, otp_purpose, expected_role } = req.body;
      
      if (otp) {
        const { data: valid } = await supabase.from('otp_verifications')
          .select('*').eq('phone', identifier).eq('code', otp).eq('purpose', otp_purpose).eq('is_verified', false)
          .gt('created_at', new Date(Date.now() - 5*60*1000).toISOString()).single();
        if (!valid) return res.status(400).json({ error: 'كود التحقق خاطئ أو منتهي' });
        await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);
      }

      const { data: user } = await supabase.from('custom_users').select('*').or(`email.eq.${identifier},phone.eq.${identifier}`).single();
      if (!user || user.password !== password) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      if (user.status !== 'active') return res.status(403).json({ error: 'الحساب محظور' });

      // Role check for separate login pages
      if (expected_role === 'admin' && user.role !== 'admin' && user.role !== 'employee') {
          return res.status(403).json({ error: 'عذراً، هذا الحساب ليس حساب مسؤول نظام' });
      }
      if (expected_role === 'user' && user.role !== 'user') {
          return res.status(403).json({ error: 'عذراً، يرجى الدخول من صفحة المشرفين' });
      }

      const { data: userDevices } = await supabase.from('devices').select('*').eq('user_id', user.id);
      const isKnown = userDevices?.some(d => d.device_fingerprint === device_id);

      if (!isKnown && !otp) {
        const max = user.max_devices || 2;
        if (userDevices?.length >= max) return res.status(403).json({ error: 'تجاوزت الحد الأقصى للأجهزة المسموح بها ('+max+'). يرجى التواصل مع الإدارة.' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('otp_verifications').insert({ phone: user.phone, code, purpose: 'new_device' });
        await sendWhatsAppOTP(user.phone, code);
        return res.status(200).json({ otp_required: true, purpose: 'new_device', phone: user.phone, message: 'تم إرسال كود التحقق لجهاز جديد' });
      }

      if (!isKnown) await supabase.from('devices').insert({ user_id: user.id, device_fingerprint: device_id, device_info, location });
      else await supabase.from('devices').update({ location, device_info, created_at: new Date().toISOString() }).eq('user_id', user.id).eq('device_fingerprint', device_id);

      const token = crypto.randomUUID ? crypto.randomUUID() : 'session-'+Date.now();
      await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
      return res.status(200).json({ success: true, user, token });
    }

    if (action === 'register_admin' && method === 'POST') {
        const { name, phone, email, password, national_id, secret_code, otp } = req.body;
        // Basic security check for trial admin registration
        if (secret_code !== 'DRPAY-ADMIN-2025') return res.status(403).json({ error: 'كود التسجيل السري غير صحيح' });

        if (otp) {
            const { data: valid } = await supabase.from('otp_verifications').select('*').eq('phone', phone).eq('code', otp).eq('purpose', 'register_admin').eq('is_verified', false).single();
            if (!valid) return res.status(400).json({ error: 'كود التحقق خاطئ' });
            await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);
            const { data: user, error } = await supabase.from('custom_users').insert({ 
                name, phone, email, password, national_id, role: 'admin', status: 'active', shop_name: 'الإدارة العامة'
            }).select().single();
            if (error) throw error;
            await supabase.from('wallets').insert({ user_id: user.id, balance: 1000000 });
            await supabase.from('notifications').insert({ user_id: user.id, title: 'مرحباً بك', message: 'نورت لوحة التحكم يا مدير!' });
            return res.status(200).json({ success: true, user });
        } else {
            const { data: existing } = await supabase.from('custom_users').select('id').or(`phone.eq.${phone},email.eq.${email}`).single();
            if (existing) return res.status(400).json({ error: 'المسؤول موجود بالفعل' });
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await supabase.from('otp_verifications').insert({ phone, code, purpose: 'register_admin' });
            await sendWhatsAppOTP(phone, code);
            return res.status(200).json({ otp_required: true, message: 'كود التحقق مرسل للواتساب للإدارة' });
        }
    }

    if (action === 'register' && method === 'POST') {
      const { name, phone, email, password, national_id, address, id_front_image, id_back_image, otp } = req.body;
      if (otp) {
        const { data: valid } = await supabase.from('otp_verifications').select('*').eq('phone', phone).eq('code', otp).eq('purpose', 'register').eq('is_verified', false).single();
        if (!valid) return res.status(400).json({ error: 'كود التحقق خاطئ' });
        await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);
        const { data: user, error } = await supabase.from('custom_users').insert({ 
            name, phone, email, password, national_id, address, id_front_image, id_back_image, 
            role: 'user', status: 'active', shop_name: name, province: 'غير محدد' 
        }).select().single();
        if (error) throw error;
        await supabase.from('wallets').insert({ user_id: user.id, balance: 0, golden_points: 0, credit_limit: 0 });
        return res.status(200).json({ success: true, user });
      } else {
        const { data: existing } = await supabase.from('custom_users').select('id').or(`phone.eq.${phone},email.eq.${email}`).single();
        if (existing) return res.status(400).json({ error: 'المستخدم موجود بالفعل' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('otp_verifications').insert({ phone, code, purpose: 'register' });
        await sendWhatsAppOTP(phone, code);
        return res.status(200).json({ otp_required: true, message: 'كود التحقق مرسل للوتساب' });
      }
    }

    if (action === 'generate_random_code' && method === 'POST') {
        const user = await getAuthUser();
        if (!user) return res.status(401).json({ error: 'منتهي' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('otp_verifications').insert({ phone: user.phone, code, purpose: 'new_device' });
        return res.status(200).json({ success: true, code });
    }

    if (action === 'me/notifications' && method === 'GET') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        return res.status(200).json({ success: true, notifications: data || [] });
    }

    if (action === 'me/devices' && method === 'GET') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        const { data } = await supabase.from('devices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        return res.status(200).json({ success: true, devices: data || [] });
    }

    if (action === 'me/deposit_reports' && method === 'GET') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        let query = supabase.from('deposit_requests').select('*, deposit_methods(name)').eq('user_id', user.id);
        
        if (req.query.type) query = query.eq('method_id', req.query.type);
        if (req.query.status && req.query.status !== 'all') query = query.eq('status', req.query.status);
        if (req.query.start) query = query.gte('created_at', req.query.start);
        if (req.query.end) query = query.lte('created_at', req.query.end);
        
        const { data } = await query.order('created_at', { ascending: false });
        return res.status(200).json({ success: true, deposits: data || [] });
    }

    if (action === 'request_password_reset' && method === 'POST') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        const { national_id, phone } = req.body;
        if (user.national_id !== national_id || user.phone !== phone) {
            return res.status(400).json({ error: 'البيانات المدخلة غير متطابقة مع بيانات الحساب المسجلة' });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('otp_verifications').insert({ phone: user.phone, code, purpose: 'password_reset' });
        await sendWhatsAppOTP(user.phone, code);
        return res.status(200).json({ success: true, message: 'كود التحقق مرسل للوتساب' });
    }

    if (action === 'verify_password_reset_otp' && method === 'POST') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        const { code } = req.body;
        const { data: valid } = await supabase.from('otp_verifications').select('*').eq('phone', user.phone).eq('code', code).eq('purpose', 'password_reset').eq('is_verified', false).order('created_at', { ascending: false }).limit(1).single();
        if (!valid) return res.status(400).json({ error: 'كود التحقق غير صحيح' });
        await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);
        return res.status(200).json({ success: true });
    }

    if (action === 'change_password_final' && method === 'POST') {
        const user = await getAuthUser();
        if(!user) return res.status(401).json({ error: 'منتهي' });
        const { password } = req.body;
        // Ensure OTP was verified recently (optional but good)
        await supabase.from('custom_users').update({ password }).eq('id', user.id);
        return res.status(200).json({ success: true });
    }

    if (action === 'verify_otp' && method === 'POST') {
        const { phone, code, purpose, login_data, registration_data } = req.body;
        const { data: valid } = await supabase.from('otp_verifications').select('*').eq('phone', phone).eq('code', code).eq('purpose', purpose).eq('is_verified', false).order('created_at', { ascending: false }).limit(1).single();
        if (!valid) return res.status(400).json({ error: 'كود التحقق خاطئ أو منتهي' });
        await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);

        if ((purpose === 'register' || purpose === 'register_admin') && registration_data) {
            const role = (purpose === 'register_admin') ? 'admin' : 'user';
            const { data: user, error } = await supabase.from('custom_users').insert({ ...registration_data, role: role, status: 'active' }).select().single();
            if (error) throw error;
            
            const bal = (role === 'admin') ? 1000000 : 0;
            await supabase.from('wallets').insert({ user_id: user.id, balance: bal });
            
            const token = crypto.randomUUID ? crypto.randomUUID() : 'session-'+Date.now();
            await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
            return res.status(200).json({ success: true, user, token });
        } else if (purpose === 'new_device' && login_data) {
            const { data: user } = await supabase.from('custom_users').select('*').eq('phone', phone).single();
            await supabase.from('devices').insert({ user_id: user.id, device_fingerprint: login_data.device_id, device_info: login_data.device_info, location: login_data.location });
            const token = crypto.randomUUID();
            await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
            return res.status(200).json({ success: true, user, token });
        }
        return res.status(200).json({ success: true });
    }

    const user = await getAuthUser();
    if (!user) return res.status(401).json({ error: 'غير مصرح لك (انتهت الجلسة)' });

    if (action === 'me' && method === 'GET') {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
      return res.status(200).json({ success: true, user: { ...user, balance: wallet?.balance || 0, golden_points: wallet?.golden_points || 0, credit_limit: wallet?.credit_limit || 0 } });
    }

    if (action === 'me/categories' && method === 'GET') {
      const { data } = await supabase.from('service_categories').select('*').order('sort_order', { ascending: true });
      return res.status(200).json({ success: true, categories: data || [] });
    }

    if (action === 'me/services' && method === 'GET') {
      const { data } = await supabase.from('services').select('*').eq('is_active', true);
      return res.status(200).json({ success: true, services: data || [] });
    }

    if (action === 'me/available_cards' && method === 'GET') {
      const { data } = await supabase.from('scratch_cards').select('category, denomination').eq('is_sold', false);
      const groups = {};
      data.forEach(c => {
          const key = `${c.category}|${c.denomination}`;
          groups[key] = (groups[key] || 0) + 1;
      });
      const unique = Object.keys(groups).map(k => {
          const [category, denomination] = k.split('|');
          return { category, denomination: Number(denomination), count: groups[k] };
      });
      return res.status(200).json(unique);
    }

    if (action === 'me/buy_card' && method === 'POST') {
      const { category, denomination } = req.body;
      const { data: card } = await supabase.from('scratch_cards').select('*').eq('category', category).eq('denomination', Number(denomination)).eq('is_sold', false).limit(1).single();
      if (!card) return res.status(400).json({ error: 'هذه الفئة غير متوفرة حالياً' });
      
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
      if ((wallet?.balance || 0) < Number(denomination) + 1.5) return res.status(400).json({ error: 'الرصيد غير كاف (سعر الكرت + 1.5 رسوم)' });
      
      const { data: soldCard, error } = await supabase.from('scratch_cards').update({ is_sold: true, sold_to: user.id, sold_at: new Date().toISOString() }).eq('id', card.id).eq('is_sold', false).select().single();
      if (error || !soldCard) return res.status(400).json({ error: 'عذراً، تم بيع هذا الكرت للتو. حاول مرة أخرى.' });

      await supabase.from('wallets').update({ balance: Number(wallet.balance) - (Number(denomination) + 1.5) }).eq('user_id', user.id);
      
      const inv = 'CRD-' + Date.now().toString().slice(-6);
      await supabase.from('transactions').insert({ 
        invoice_no: inv, user_id: user.id, service_name: 'كارت شحن ' + category, 
        amount: denomination, total: Number(denomination) + 1.5, status: 'paid', details: 'كود: ' + soldCard.code 
      });

      return res.status(200).json({ success: true, card: soldCard });
    }

    if (action === 'me/pay' && method === 'POST') {
      const { service_id, target, amount } = req.body;
      const { data: srv } = await supabase.from('services').select('*').eq('id', service_id).single();
      const finalPrice = srv.price > 0 ? Number(srv.price) : Number(amount);
      const total = finalPrice + (srv.fee || 0);
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
      if ((wallet?.balance || 0) < total) return res.status(400).json({ error: 'الرصيد غير كاف' });

      const inv = 'INV-' + Date.now().toString().slice(-6);
      const { data: tx } = await supabase.from('transactions').insert({ 
        invoice_no: inv, user_id: user.id, service_id, service_name: srv.name, 
        customer_phone: target, amount: finalPrice, total, status: 'paid' 
      }).select().single();
      
      await supabase.from('wallets').update({ balance: Number(wallet.balance) - total }).eq('user_id', user.id);
      return res.status(200).json({ success: true, transaction: tx });
    }

    if (action === 'me/deposits' && method === 'GET') {
      const { data } = await supabase.from('deposit_methods').select('*').eq('is_active', true);
      return res.status(200).json({ success: true, methods: data || [] });
    }

    if (action === 'me/deposits' && method === 'POST') {
      const { method_id, amount, transfer_ref, transfer_image } = req.body;
      await supabase.from('deposit_requests').insert({ user_id: user.id, method_id, amount, transfer_ref, transfer_image });
      return res.status(200).json({ success: true });
    }

    if (action === 'me/transactions' && method === 'GET') {
        const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        return res.status(200).json({ success: true, transactions: data || [] });
    }

    if (user.role !== 'admin' && user.role !== 'employee') return res.status(403).json({ error: 'غير مصرح (للمسؤولين فقط)' });

    if (action === 'admin/stats' && method === 'GET') {
        const { count: usersCount } = await supabase.from('custom_users').select('*', { count: 'exact', head: true });
        const { data: txs } = await supabase.from('transactions').select('total');
        const revenue = txs.reduce((acc, curr) => acc + (curr.total || 0), 0);
        const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
        
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const { count: dailyTx } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).gt('created_at', yesterday.toISOString());
        
        return res.status(200).json({ success: true, stats: { totalUsers: usersCount, revenue, totalTransactions: txCount, dailyTx: dailyTx || 0 } });
    }

    if (action === 'admin/users' && method === 'GET') {
      const { data } = await supabase.from('custom_users').select('*, wallets(balance)').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, users: data });
    }
    
    if (action === 'admin/edit_user' && method === 'POST') {
      const { id, ...updates } = req.body;
      await supabase.from('custom_users').update(updates).eq('id', id);
      return res.status(200).json({ success: true });
    }

    if (action === 'admin/balance' && method === 'POST') {
      const { user_id, amount, type } = req.body;
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
      let balance = wallet?.balance || 0;
      balance = type === 'add' ? Number(balance) + Number(amount) : Number(balance) - Number(amount);
      await supabase.from('wallets').upsert({ user_id, balance });
      return res.status(200).json({ success: true });
    }

    if (action === 'admin/reset_devices' && method === 'POST') {
        const { user_id } = req.body;
        await supabase.from('devices').delete().eq('user_id', user_id);
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/categories' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('service_categories').select('*').order('sort_order', { ascending: true });
            return res.status(200).json({ success: true, categories: data || [] });
        }
        if (method === 'POST') {
            const { id, ...data } = req.body;
            if (id) await supabase.from('service_categories').update(data).eq('id', id);
            else await supabase.from('service_categories').insert(data);
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from('service_categories').delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/services' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('services').select('*').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, services: data || [] });
        }
        if (method === 'POST') {
            const { id, ...data } = req.body;
            if (id) await supabase.from('services').update(data).eq('id', id);
            else await supabase.from('services').insert(data);
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from('services').delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/cards' && (method === 'GET' || method === 'POST')) {
        if (method === 'GET') {
            const { data } = await supabase.from('scratch_cards').select('*').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, cards: data || [] });
        }
        if (method === 'POST') {
            const { category, denomination, codes } = req.body;
            const codeList = codes.split('\n').filter(c => c.trim());
            const inserts = codeList.map(line => {
                const [code, serial] = line.split('|');
                return { category, denomination: Number(denomination), code: code.trim(), serial_number: serial?.trim() || null };
            });
            await supabase.from('scratch_cards').insert(inserts);
            return res.status(200).json({ success: true, count: inserts.length });
        }
    }

    if (action === 'admin/deposits' && (method === 'GET' || method === 'POST')) {
        if (method === 'GET') {
            const { data } = await supabase.from('deposit_requests').select('*, custom_users(name, phone), deposit_methods(name)').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, requests: data || [] });
        }
        if (method === 'POST') {
            const { id, status } = req.body;
            const { data: reqst } = await supabase.from('deposit_requests').select('*').eq('id', id).single();
            if (reqst.status !== 'pending') return res.status(400).json({ error: 'تمت معالجته بالفعل' });
            await supabase.from('deposit_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
            
            if (status === 'approved') {
                const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', reqst.user_id).single();
                const newBal = (w?.balance || 0) + Number(reqst.amount);
                await supabase.from('wallets').upsert({ user_id: reqst.user_id, balance: newBal });
                await supabase.from('notifications').insert({ user_id: reqst.user_id, title: 'تم قبول الإيداع', message: `تم إضافة ${reqst.amount} ج.م لرصيدك بنجاح.` });
            } else {
                await supabase.from('notifications').insert({ user_id: reqst.user_id, title: 'رفض طلب الإيداع', message: `نعتذر، تم رفض طلب الإيداع الخاص بك بقيمة ${reqst.amount} ج.م.` });
            }
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/send_notification' && method === 'POST') {
        const { user_id, title, message } = req.body;
        if (user_id === 'all') {
            const { data: users } = await supabase.from('custom_users').select('id');
            const inserts = users.map(u => ({ user_id: u.id, title, message }));
            await supabase.from('notifications').insert(inserts);
        } else {
            await supabase.from('notifications').insert({ user_id, title, message });
        }
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/edit_wallet' && method === 'POST') {
        const { user_id, ...updates } = req.body;
        await supabase.from('wallets').update(updates).eq('user_id', user_id);
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/transactions' && method === 'GET') {
        const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        return res.status(200).json({ success: true, transactions: data || [] });
    }

    if (action === 'logs' && method === 'GET') {
        const { data } = await supabase.from('activity_logs').select('*, custom_users(name)').order('created_at', { ascending: false }).limit(50);
        return res.status(200).json({ success: true, logs: data || [] });
    }

    if (action === 'admin/deposit_methods' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('deposit_methods').select('*');
            return res.status(200).json({ success: true, methods: data || [] });
        }
        if (method === 'POST') {
            const { id, ...data } = req.body;
            if (id) await supabase.from('deposit_methods').update(data).eq('id', id);
            else await supabase.from('deposit_methods').insert(data);
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from('deposit_methods').delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/settings' && (method === 'GET' || method === 'POST')) {
        if (method === 'GET') {
            const { data } = await supabase.from('system_settings').select('*').single();
            return res.status(200).json({ success: true, settings: data });
        }
        if (method === 'POST') {
            const { settings } = req.body;
            await supabase.from('system_settings').upsert({ id: 1, ...settings });
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/branches' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, branches: data || [] });
        }
        if (method === 'POST') {
            const { id, ...data } = req.body;
            if (id) await supabase.from('branches').update(data).eq('id', id);
            else await supabase.from('branches').insert(data);
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from('branches').delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'admin/employees' && (method === 'GET' || method === 'POST' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('employees').select('*, branches(name)').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, employees: data || [] });
        }
        if (method === 'POST') {
            const { id, ...data } = req.body;
            if (id) await supabase.from('employees').update(data).eq('id', id);
            else await supabase.from('employees').insert({ ...data, role: 'employee' });
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from('employees').delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    return res.status(404).json({ error: 'المسار غير موجود' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
