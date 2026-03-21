const { createClient } = require('@supabase/supabase-js');

/**
 * دكتور باي - سكربت إضافة أدمن تجريبي للنظام
 * يتم استخدام هذا السكربت لإنشاء حساب مسؤول كامل الصلاحيات لتجربة لوحة التحكم
 * 
 * طريقة التشغيل:
 * node "اضافه_ادمن_تجريبي.js"
 * 
 * لحذف الحساب بعد التجربة:
 * node "اضافه_ادمن_تجريبي.js" --delete
 */

// إعدادات الاتصال بقاعدة البيانات
const supabaseUrl = 'https://auwnsxmdksplftccysqu.supabase.co';
const supabaseKey = 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi';
const supabase = createClient(supabaseUrl, supabaseKey);

// بيانات الأدمن التجريبي
const adminData = {
    name: "مدير النظام التجريبي",
    phone: "01099999999", // رقم مميز للتجربة
    email: "test_admin@drpay.com",
    password: "Admin@2025@Test", // كلمة مرور قوية للتجربة
    role: "admin",
    status: "active",
    national_id: "29901010000000"
};

/**
 * وظيفة إنشاء الأدمن
 */
async function createExperimentalAdmin() {
    console.log("\n🚀 جاري بدء عملية إنشاء حساب مسؤول نظام تجريبي...");
    
    // التأكد من عدم وجود الحساب مسبقاً بنفس رقم الهاتف
    const { data: existing } = await supabase
        .from('custom_users')
        .select('id')
        .eq('phone', adminData.phone)
        .single();

    if (existing) {
        console.log("⚠️ تنبيه: هذا الحساب موجود بالفعل في النظام.");
        console.log("🆔 معرف المستخدم (ID):", existing.id);
        console.log("💡 يمكنك حذفه أولاً باستخدام الأمر --delete ثم إعادة إنشائه.\n");
        return;
    }

    // إدراج بيانات المستخدم الجديد
    const { data: user, error } = await supabase
        .from('custom_users')
        .insert(adminData)
        .select()
        .single();
    
    if (error) {
        console.error("❌ خطأ فني أثناء إنشاء الحساب:", error.message);
        return;
    }

    // إنشاء محفظة بمليون جنيه للتجربة
    const { error: walletError } = await supabase
        .from('wallets')
        .insert({ 
            user_id: user.id, 
            balance: 1000000.00 
        });

    if (walletError) {
        console.error("⚠️ تم إنشاء الحساب ولكن فشل إنشاء المحفظة:", walletError.message);
    } else {
        console.log("💰 تم تفعيل محفظة المسؤول برصيد تجريبي (1,000,000 ج.م)");
    }

    console.log("\n✅ تمت العملية بنجاح باهر!");
    console.log("=========================================");
    console.log("📱 بيانات الدخول للوحة الإدارة (admin.html):");
    console.log("📞 رقم الهاتف: " + adminData.phone);
    console.log("🔑 كلمة السر: " + adminData.password);
    console.log("=========================================");
    console.log("⚠️ تذكر حذف هذا الملف وهذا الحساب بعد انتهاء التجربة لضمان أمان النظام.\n");
}

/**
 * وظيفة حذف الأدمن
 */
async function deleteExperimentalAdmin() {
    console.log("\n🗑️ جاري حذف الحساب التجريبي وتنظيف النظام...");
    
    // ستقوم قاعدة البيانات بحذف المحفظة تلقائياً بسبب ON DELETE CASCADE
    const { error } = await supabase
        .from('custom_users')
        .delete()
        .eq('phone', adminData.phone);

    if (error) {
        console.error("❌ فشلت عملية الحذف:", error.message);
    } else {
        console.log("✨ تم تنظيف النظام وحذف الحساب التجريبي بنجاح.\n");
    }
}

// التحكم في التشغيل بناءً على الأوامر (Arguments)
if (process.argv.includes('--delete')) {
    deleteExperimentalAdmin();
} else {
    createExperimentalAdmin();
}
