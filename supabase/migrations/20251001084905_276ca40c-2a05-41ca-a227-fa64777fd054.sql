-- Step 1: Add admin role to user_role enum and banned field
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- Add banned field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;