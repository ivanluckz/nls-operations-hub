-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('student', 'moderator');

-- Create enum for allocation status
CREATE TYPE allocation_status AS ENUM ('pending', 'allocated', 'waitlisted');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Moderators can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'moderator'
    )
  );

-- Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  teacher_in_charge TEXT NOT NULL,
  schedule TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  current_enrollment INTEGER NOT NULL DEFAULT 0 CHECK (current_enrollment >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Activities policies
CREATE POLICY "Anyone can view active activities"
  ON public.activities FOR SELECT
  USING (is_active = true);

CREATE POLICY "Moderators can manage activities"
  ON public.activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'moderator'
    )
  );

-- Create preferences table
CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_choice UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  second_choice UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  third_choice UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id),
  CHECK (first_choice != second_choice AND first_choice != third_choice AND second_choice != third_choice)
);

-- Enable RLS on preferences
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Preferences policies
CREATE POLICY "Students can view their own preferences"
  ON public.preferences FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own preferences"
  ON public.preferences FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own preferences"
  ON public.preferences FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "Moderators can view all preferences"
  ON public.preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'moderator'
    )
  );

-- Create allocations table
CREATE TABLE public.allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  preference_rank INTEGER NOT NULL CHECK (preference_rank BETWEEN 1 AND 3),
  status allocation_status NOT NULL DEFAULT 'allocated',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Enable RLS on allocations
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- Allocations policies
CREATE POLICY "Students can view their own allocation"
  ON public.allocations FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Moderators can manage allocations"
  ON public.allocations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'moderator'
    )
  );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON public.preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();