const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://auwnsxmdksplftccysqu.supabase.co';
const supabaseKey = 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("جارِ فحص الاتصال بقاعدة البيانات Supabase...");
    try {
        const { data, error } = await supabase.from('custom_users').select('*').limit(2);
        if (error) throw error;
        console.log("✅ الاتصال بقاعدة البيانات ناجح ومستقر 100%!");
        console.log("تم جلب بيانات تجريبية (الجدول يعمل بشكل ممتاز):", data);
    } catch(err) {
        console.error("❌ خطأ بالاتصال:", err.message);
    }
}
test();
