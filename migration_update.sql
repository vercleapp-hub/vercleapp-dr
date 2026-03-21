-- Run this in Supabase SQL Editor to update your schema
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS shop_address TEXT;
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS registration_location JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
ALTER TABLE public.otp_verifications ADD CONSTRAINT otp_verifications_purpose_check 
CHECK (purpose IN ('register', 'new_device', 'register_admin', 'password_reset'));

-- 3. Update Wallets schema if missing columns
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS golden_points NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) DEFAULT 0.00;

-- 4. Create Tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.custom_users(id),
    subject TEXT,
    message TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
