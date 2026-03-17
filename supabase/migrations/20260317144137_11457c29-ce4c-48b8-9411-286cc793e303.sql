
ALTER TABLE public.profiles ADD COLUMN student_class text;
ALTER TABLE public.profiles ADD COLUMN mentor_id uuid;
ALTER TABLE public.meal_attendance ADD COLUMN house_id uuid REFERENCES public.houses(id);
