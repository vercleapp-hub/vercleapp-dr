-- Dr Pay Elite Database Schema
-- Run this entire script in Supabase SQL Editor to build the system from scratch

-- 1. Users & Merchants
CREATE TABLE IF NOT EXISTS public.custom_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'employee')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    national_id TEXT,
    address TEXT,
    id_front_image TEXT,
    id_back_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- 3. Available Services
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    company TEXT,
    fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Payment Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_no TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    service_data JSONB DEFAULT '{}'::jsonb,
    amount NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
    payment_company TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Generated Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Merchant Deposit Methods
CREATE TABLE IF NOT EXISTS public.deposit_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    details TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Deposit / Top-up Requests
CREATE TABLE IF NOT EXISTS public.deposit_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
    method_id UUID REFERENCES public.deposit_methods(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    transfer_ref TEXT,
    transfer_image TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Branches
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. System Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. User Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Global Settings
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Basic Seeding
INSERT INTO public.settings (key, value)
VALUES ('system_settings', '{"currency": "ط¬.ظ…", "system_name": "Dr Pay", "fees_percentage": 0}')
ON CONFLICT (key) DO NOTHING;

-- 13. Tracker & Authorized Devices
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_info JSONB DEFAULT '{}'::jsonb,
    location JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, device_fingerprint)
);

-- 14. Max devices per user (ALTER existing table)
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 2;

-- 15. Service Categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Add category to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 17. Scratch Cards (Recharge Cards Inventory)
CREATE TABLE IF NOT EXISTS public.scratch_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    denomination NUMERIC(10, 2) NOT NULL,
    code TEXT NOT NULL,
    serial_number TEXT,
    is_sold BOOLEAN DEFAULT false,
    sold_to UUID REFERENCES public.custom_users(id) ON DELETE SET NULL,
    sold_at TIMESTAMP WITH TIME ZONE,
    added_by UUID REFERENCES public.custom_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. OTP Verifications
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT CHECK (purpose IN ('register', 'new_device')),
    is_verified BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
