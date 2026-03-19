import { createClient } from '@supabase/supabase-js'

// 🔴 حط بياناتك هنا
const supabase = createClient(
  'https://auwnsxmdksplftccysqu.supabase.co',
  'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi'
)

// 🚀 ده API endpoint
export default async function handler(req, res) {
  try {
    // 📨 ناخد النص من الرابط
    const text = req.query.text || "hello"

    // 💾 نحفظ في الداتابيز
    const { data, error } = await supabase
      .from('messages')
      .insert([{ text }])
      .select()

    // ❌ لو فيه خطأ
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }

    // ✅ لو تمام
    return res.status(200).json({
      success: true,
      message: "تم الحفظ بنجاح",
      data
    })

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    })
  }
}
