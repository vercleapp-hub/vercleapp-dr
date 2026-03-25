import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { action } = req.query

  // ================= LOGIN =================
  if (action === 'login') {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({ error: 'بيانات ناقصة' })
    }

    // جلب المستخدم
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (!user || error) {
      return res.status(404).json({ error: 'المستخدم غير موجود' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'الحساب موقوف' })
    }

    // مقارنة الباسورد
    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res.status(401).json({ error: 'كلمة المرور غلط' })
    }

    // إنشاء توكن
    const token = uuidv4()

    await supabase.from('sessions').insert([
      { user_id: user.id, token }
    ])

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role
      }
    })
  }

  return res.status(400).json({ error: 'invalid action' })
}
