-- ================================================
-- CivicSync: Safe re-runnable schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- ISSUES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  location_address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  image_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "Issues are viewable by everyone" ON public.issues;
DROP POLICY IF EXISTS "Authenticated users can insert issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update their own issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete their own issues" ON public.issues;

-- Recreate policies
CREATE POLICY "Issues are viewable by everyone"
  ON public.issues FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert issues"
  ON public.issues FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own issues"
  ON public.issues FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own issues"
  ON public.issues FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_issues_updated_at ON public.issues;
CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- PROFILES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- STORAGE BUCKET
-- ================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-images', 'issue-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view issue images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue images" ON storage.objects;

CREATE POLICY "Anyone can view issue images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-images');

CREATE POLICY "Authenticated users can upload issue images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-images' AND auth.uid() IS NOT NULL);

-- ================================================
-- SEED DATA (sample issues so app isn't empty)
-- ================================================
INSERT INTO public.issues (title, description, category, status, location_address, lat, lng)
VALUES
  ('Pothole on Main St', 'Large pothole causing damage to vehicles near the intersection', 'Road Maintenance', 'open', '245 Market St, San Francisco, CA', 37.7749, -122.4194),
  ('Uncollected trash bins', 'Trash bins not collected for 3 consecutive days in the park area', 'Waste Management', 'in_progress', 'Central Park, New York', 40.7851, -73.9683),
  ('Broken lamp post fixed', 'Street lamp at Oak Street was repaired successfully', 'Street Lighting', 'resolved', 'Oak Street, Boston MA', 42.3601, -71.0589),
  ('Water pipe leaking', 'Water is flowing on the street since morning, causing flooding', 'Water Supply', 'open', '5th Avenue, New York', 40.7731, -73.9657),
  ('Fallen tree blocking road', 'A large tree has fallen and is blocking vehicle access', 'Public Safety', 'in_progress', 'Elm Street, Chicago IL', 41.8781, -87.6298)
ON CONFLICT DO NOTHING;
