-- Seed premium themes to the marketplace
-- Run: psql -h <host> -U postgres -d postgres -f seed-themes.sql

-- Admin user ID (you may need to adjust this)
-- First, get a valid user from your system:
-- SELECT id FROM auth.users LIMIT 1;

-- For now, use a placeholder admin ID that you'll update
WITH admin_user AS (
  SELECT id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1
)
INSERT INTO public.user_themes (name, description, css_url, js_url, is_public, user_id, install_count, like_count)
VALUES
-- Theme 1: Midnight Athlete
('Midnight Athlete', 'Dark, energetic theme with neon accents perfect for athletes. High contrast for focus and motivation.',
 'https://storage.googleapis.com/nls-themes/midnight-athlete.css',
 'https://storage.googleapis.com/nls-themes/neon-pulse.js',
 true, (SELECT id FROM admin_user), 0, 0),

-- Theme 2: Fresh Energy
('Fresh Energy', 'Bright, wellness-focused theme with greens and blues. Perfect for health and activity tracking.',
 'https://storage.googleapis.com/nls-themes/fresh-energy.css',
 'https://storage.googleapis.com/nls-themes/wellness-animation.js',
 true, (SELECT id FROM admin_user), 0, 0),

-- Theme 3: Elite Focus
('Elite Focus', 'Minimalist dark theme with premium typography. Perfect for serious athletes and coaches.',
 'https://storage.googleapis.com/nls-themes/elite-focus.css',
 NULL,
 true, (SELECT id FROM admin_user), 0, 0);
