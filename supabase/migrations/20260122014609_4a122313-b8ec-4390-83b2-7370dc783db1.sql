-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  preferred_ai_model TEXT DEFAULT 'gemini',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create business analyses table
CREATE TABLE public.business_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_idea TEXT NOT NULL,
  location TEXT,
  budget TEXT,
  verdict TEXT CHECK (verdict IN ('GO', 'CAUTION', 'AVOID')),
  score INTEGER,
  summary TEXT,
  analysis_data JSONB,
  ai_model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create usage analytics table
CREATE TABLE public.usage_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create historical trends table (sample data from 2019)
CREATE TABLE public.market_trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sector TEXT NOT NULL,
  market_size DECIMAL,
  growth_rate DECIMAL,
  investment_volume DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_trends ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Business analyses policies
CREATE POLICY "Users can view their own analyses" ON public.business_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own analyses" ON public.business_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own analyses" ON public.business_analyses FOR DELETE USING (auth.uid() = user_id);

-- Usage analytics policies
CREATE POLICY "Users can view their own analytics" ON public.usage_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own analytics" ON public.usage_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Market trends are publicly readable
CREATE POLICY "Anyone can view market trends" ON public.market_trends FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating profiles
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Insert sample historical market trends data (2019-2025)
INSERT INTO public.market_trends (year, month, sector, market_size, growth_rate, investment_volume) VALUES
-- 2019
(2019, 1, 'Food & Beverage', 45000, 8.5, 1200),
(2019, 6, 'Food & Beverage', 48000, 9.2, 1350),
(2019, 12, 'Food & Beverage', 52000, 10.1, 1500),
(2019, 1, 'Technology', 85000, 15.2, 4500),
(2019, 6, 'Technology', 92000, 16.8, 5200),
(2019, 12, 'Technology', 98000, 18.5, 6000),
-- 2020
(2020, 1, 'Food & Beverage', 50000, 7.2, 1100),
(2020, 6, 'Food & Beverage', 42000, -5.5, 800),
(2020, 12, 'Food & Beverage', 48000, 4.2, 950),
(2020, 1, 'Technology', 102000, 20.5, 7000),
(2020, 6, 'Technology', 125000, 28.2, 9500),
(2020, 12, 'Technology', 145000, 32.1, 12000),
-- 2021
(2021, 1, 'Food & Beverage', 55000, 12.5, 1400),
(2021, 6, 'Food & Beverage', 62000, 15.8, 1800),
(2021, 12, 'Food & Beverage', 70000, 18.2, 2200),
(2021, 1, 'Technology', 158000, 25.5, 14000),
(2021, 6, 'Technology', 175000, 22.8, 16500),
(2021, 12, 'Technology', 195000, 21.2, 18000),
-- 2022
(2022, 1, 'Food & Beverage', 75000, 14.2, 2400),
(2022, 6, 'Food & Beverage', 82000, 12.5, 2800),
(2022, 12, 'Food & Beverage', 88000, 10.8, 3100),
(2022, 1, 'Technology', 205000, 18.2, 19000),
(2022, 6, 'Technology', 218000, 15.5, 20500),
(2022, 12, 'Technology', 225000, 12.8, 21000),
-- 2023
(2023, 1, 'Food & Beverage', 92000, 11.5, 3300),
(2023, 6, 'Food & Beverage', 98000, 10.2, 3600),
(2023, 12, 'Food & Beverage', 105000, 9.8, 3900),
(2023, 1, 'Technology', 235000, 14.2, 22000),
(2023, 6, 'Technology', 248000, 12.8, 23500),
(2023, 12, 'Technology', 262000, 11.5, 25000),
-- 2024
(2024, 1, 'Food & Beverage', 110000, 10.5, 4200),
(2024, 6, 'Food & Beverage', 118000, 9.8, 4600),
(2024, 12, 'Food & Beverage', 125000, 9.2, 5000),
(2024, 1, 'Technology', 275000, 12.5, 26500),
(2024, 6, 'Technology', 290000, 11.8, 28000),
(2024, 12, 'Technology', 305000, 11.2, 29500),
-- 2025
(2025, 1, 'Food & Beverage', 130000, 9.5, 5300);
INSERT INTO public.market_trends (year, month, sector, market_size, growth_rate, investment_volume) VALUES
(2025, 1, 'Technology', 318000, 10.8, 31000);