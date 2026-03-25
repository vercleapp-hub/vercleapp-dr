const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://auwnsxmdksplftccysqu.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi'
);

// Helper to standardize Egyptian phone numbers (Last 11 digits: 01xxxxxxxxx)
function standardizePhone(phone) {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');
    if (clean.length > 11) {
        return '0' + clean.slice(-10);
    }
    if (clean.length === 10 && !clean.startsWith('0')) {
        return '0' + clean;
    }
    return clean;
}

const ULTRA_MSG_INSTANCE = "instance166591";
const ULTRA_MSG_TOKEN = "merz7515ky1dxc2v";

async function sendWhatsAppOTP(phone, code) {
  try {
    const cleanPhone = standardizePhone(phone); 
    const to = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
    const body = `رمز التحقق الخاص بك في الدكتور باي هو: ${code}\nيرجى عدم مشاركة هذا الرمز مع أي شخص.`;
    
    await fetch(`https://api.ultramsg.com/${ULTRA_MSG_INSTANCE}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ULTRA_MSG_TOKEN, to: to, body: body })
    });
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  let action = req.query.action || '';
  const method = req.method;

  const getAuthUser = async () => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    const { data: session } = await supabase.from('sessions').select('user_id').eq('session_id', token).single();
    if (!session) return null;
    const { data: user } = await supabase.from('custom_users').select('*').eq('id', session.user_id).single();
    if (!user || user.status !== 'active') return null;
    return user;
  };

  try {
    // PUBLIC ROUTES
    if (action === 'check_user_existence' && method === 'POST') {
        const { phone, national_id } = req.body;
        const cleanPhone = standardizePhone(phone);
        const { data: existing } = await supabase.from('custom_users').select('id').or(`phone.eq.${cleanPhone},national_id.eq.${national_id}`).single();
        if (existing) return res.status(400).json({ error: 'عذراً، هذا الحساب مسجل مسبقاً لدينا.' });
        return res.status(200).json({ success: true, message: 'البيانات متاحة.' });
    }

    if (action === 'login' && method === 'POST') {
      const { identifier, password, device_id, location, device_info, otp, otp_purpose, expected_role } = req.body;
      
      const cleanID = standardizePhone(identifier);
      const { data: user } = await supabase.from('custom_users').select('*').or(`email.eq.${identifier},phone.eq.${cleanID}`).single();
      if (!user || user.password !== password) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      if (user.status !== 'active') return res.status(403).json({ error: 'الحساب محظور' });

      if (expected_role === 'admin' && user.role !== 'admin' && user.role !== 'employee') return res.status(403).json({ error: 'حساب مسؤول فقط' });
      if (expected_role === 'user' && user.role !== 'user') return res.status(403).json({ error: 'حساب مستخدم فقط' });

      if (otp) {
        const cleanCode = otp.toString().replace(/\D/g, '').trim();
        const { data: valid } = await supabase.from('otp_verifications').select('*').eq('phone', cleanID).eq('code', cleanCode).eq('purpose', otp_purpose).eq('is_verified', false)
          .gt('created_at', new Date(Date.now() - 30*60*1000).toISOString()).single();
        if (!valid) return res.status(400).json({ error: 'كود التحقق خاطئ' });
        await supabase.from('otp_verifications').update({ is_verified: true }).eq('id', valid.id);
      } else {
        const { data: userDevices } = await supabase.from('devices').select('*').eq('user_id', user.id);
        const isKnown = userDevices?.some(d => d.device_fingerprint === device_id);

        if (!isKnown) {
          const max = user.max_devices || 2;
          if (userDevices?.length >= max) return res.status(403).json({ error: 'تجاوزت الحد الأقصى للأجهزة ('+max+')' });
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          await supabase.from('otp_verifications').insert({ phone: user.phone, code, purpose: 'new_device' });
          await sendWhatsAppOTP(user.phone, code);
          return res.status(200).json({ otp_required: true, purpose: 'new_device', phone: user.phone });
        }
      }

      await supabase.from('devices').upsert({ user_id: user.id, device_fingerprint: device_id, device_info, location }, { onConflict: 'user_id,device_fingerprint' });
      const token = crypto.randomUUID ? crypto.randomUUID() : 'session-'+Date.now();
      await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
      return res.status(200).json({ success: true, user, token });
    }

    // AUTH REQUIRED ROUTES
    const user = await getAuthUser();
    if (!user) return res.status(401).json({ error: 'انتهت الجلسة' });

    const logActivity = async (action, details) => {
        await supabase.from('activity_logs').insert({ user_id: user.id, action, details });
    };

    if (action === 'me' && method === 'GET') {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
      return res.status(200).json({ success: true, user: { ...user, balance: wallet?.balance || 0, golden_points: wallet?.golden_points || 0, credit_limit: wallet?.credit_limit || 0 } });
    }

    if (action === 'me/pay' && method === 'POST') {
      const { service_id, target, amount } = req.body;
      const { data: srv } = await supabase.from('services').select('*').eq('id', service_id).single();
      const total = (srv.price > 0 ? Number(srv.price) : Number(amount)) + (srv.fee || 0);
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
      if ((wallet?.balance || 0) < total) return res.status(400).json({ error: 'الرصيد غير كاف' });
      const { data: tx } = await supabase.from('transactions').insert({ invoice_no: 'INV-'+Date.now(), user_id: user.id, service_name: srv.name, customer_phone: target, amount: total, total, status: 'paid' }).select().single();
      await supabase.from('wallets').update({ balance: Number(wallet.balance) - total }).eq('user_id', user.id);
      return res.status(200).json({ success: true, transaction: tx });
    }

    if (action === 'me/transactions' && method === 'GET') {
        const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        return res.status(200).json({ success: true, transactions: data || [] });
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

    if (action === 'me/tickets' && (method === 'GET' || method === 'POST')) {
        if (method === 'GET') {
            const { data } = await supabase.from('tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            return res.status(200).json({ success: true, tickets: data || [] });
        }
        if (method === 'POST') {
            const { subject, message, priority } = req.body;
            await supabase.from('tickets').insert({ user_id: user.id, subject, message, priority: priority || 'normal' });
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'me/devices' && (method === 'GET' || method === 'DELETE')) {
        if (method === 'GET') {
            const { data } = await supabase.from('devices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            return res.status(200).json({ success: true, devices: data || [] });
        }
        if (method === 'DELETE') {
            await supabase.from('devices').delete().eq('id', req.query.id).eq('user_id', user.id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'categories' && method === 'GET') {
        const { data } = await supabase.from('service_categories').select('*').order('sort_order', { ascending: true });
        return res.status(200).json({ success: true, categories: data || [] });
    }

    if (action === 'services' && method === 'GET') {
        const { data } = await supabase.from('services').select('*').eq('is_active', true).order('name', { ascending: true });
        return res.status(200).json({ success: true, services: data || [] });
    }

    // ADMIN ROUTES
    if (user.role !== 'admin' && user.role !== 'employee') return res.status(403).json({ error: 'غير مصرح للموظفين والدكاترة فقط' });

    if (action === 'admin/stats' && method === 'GET') {
        const { count: usersCount } = await supabase.from('custom_users').select('*', { count: 'exact', head: true });
        const { data: txs } = await supabase.from('transactions').select('total');
        const revenue = txs.reduce((acc, curr) => acc + (curr.total || 0), 0);
        return res.status(200).json({ success: true, stats: { totalUsers: usersCount, revenue, totalTransactions: txs.length, dailyTx: 0 } });
    }

    if (action === 'admin/users' && method === 'GET') {
        const { data } = await supabase.from('custom_users').select('*, wallets(balance, golden_points, credit_limit)').order('created_at', { ascending: false });
        return res.status(200).json({ success: true, users: data });
    }

    if (action === 'admin/edit_user' && method === 'POST') {
        const { id, ...updates } = req.body;
        await supabase.from('custom_users').update(updates).eq('id', id);
        await logActivity('تعديل حساب', `تعديل بيانات المستخدم ID: ${id}`);
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/balance' && method === 'POST') {
        const { user_id, amount, type } = req.body;
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
        const newBal = type === 'add' ? (wallet?.balance || 0) + Number(amount) : (wallet?.balance || 0) - Number(amount);
        await supabase.from('wallets').upsert({ user_id, balance: newBal });
        await logActivity('شحن رصيد', `${type === 'add' ? 'إيداع' : 'خصم'} مبلغ ${amount} ج.م`);
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/tickets' && (method === 'GET' || method === 'POST')) {
        if (method === 'GET') {
            const { data } = await supabase.from('tickets').select('*, custom_users(name)').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, tickets: data || [] });
        }
        if (method === 'POST') {
            const { id, status } = req.body;
            await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
            return res.status(200).json({ success: true });
        }
    }

    if (action === 'logs' && method === 'GET') {
        const { data } = await supabase.from('activity_logs').select('*, custom_users(name)').order('created_at', { ascending: false }).limit(200);
        return res.status(200).json({ success: true, logs: data || [] });
    }

    // Dynamic fallback for simple tables
    if (action.startsWith('admin/')) {
        const table = action.split('/')[1];
        const allowedTables = ['branches', 'employees', 'service_categories', 'services', 'deposit_methods', 'scratch_cards', 'system_settings'];
        if (!allowedTables.includes(table)) return res.status(404).json({ error: 'جدول غير موجود' });

        if (method === 'GET') {
            const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
            return res.status(200).json({ success: true, [table]: data || [] });
        }
        if (method === 'POST') {
            const { id, ...body } = req.body;
            if (id) await supabase.from(table).update(body).eq('id', id);
            else await supabase.from(table).insert(body);
            return res.status(200).json({ success: true });
        }
        if (method === 'DELETE') {
            await supabase.from(table).delete().eq('id', req.body.id);
            return res.status(200).json({ success: true });
        }
    }

    return res.status(404).json({ error: 'المسار غير موجود' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
