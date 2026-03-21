const { createClient } = require('@supabase/supabase-js');

// Supabase Configuration (Fetched from api/index.js)
const supabaseUrl = 'https://auwnsxmdksplftccysqu.supabase.co';
const supabaseKey = 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi';
const supabase = createClient(supabaseUrl, supabaseKey);

const adminData = {
    name: "مسؤول النظام تجريبي",
    phone: "01000000000",
    email: "admin_test@drpay.com",
    password: "Admin@Password123",
    role: "admin",
    status: "active"
};

async function createTrialAdmin() {
    console.log("--- جاري إنشاء حساب أدمن تجريبي ---");
    
    // 1. Check if exists
    const { data: existing } = await supabase.from('custom_users').select('id').eq('phone', adminData.phone).single();
    if (existing) {
        console.log("⚠️ الحساب موجود بالفعل مسبقاً.");
        console.log("ID:", existing.id);
        return;
    }

    // 2. Insert User
    const { data: user, error } = await supabase.from('custom_users').insert(adminData).select().single();
    
    if (error) {
        console.error("❌ خطأ أثناء إنشاء الحساب:", error.message);
        return;
    }

    // 3. Create Wallet
    await supabase.from('wallets').insert({ user_id: user.id, balance: 1000000 });

    console.log("✅ تمت العملية بنجاح!");
    console.log("-----------------------");
    console.log("بيانات الدخول:");
    console.log("الهاتف:", adminData.phone);
    console.log("كلمة السر:", adminData.password);
    console.log("-----------------------");
    console.log("💡 لحذف هذا الحساب بعد التجربة، قم بتشغيل السكربت مع إضافة --delete");
}

async function deleteTrialAdmin() {
    console.log("--- جاري حذف الحساب التجريبي ---");
    const { error } = await supabase.from('custom_users').delete().eq('phone', adminData.phone);
    if (error) console.error("❌ خطأ أثناء الحذف:", error.message);
    else console.log("🗑️ تم حذف الحساب بنجاح.");
}

// Check arguments
if (process.argv.includes('--delete')) {
    deleteTrialAdmin();
} else {
    createTrialAdmin();
}
