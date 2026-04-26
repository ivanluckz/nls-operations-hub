/**
 * Browser-based theme marketplace seeding
 * Can be called from dev console or imported in a component
 */

import { supabase } from '@/integrations/supabase/client';

export const premiumThemes = [
  {
    name: 'Midnight Athlete',
    description: 'Dark, energetic theme with neon cyan and magenta accents. Perfect for focused athletes who want high contrast and electric energy.',
    css: `/* Midnight Athlete Theme - Dark Energy for Champions */
html:root {
  --primary: 180 100% 50% !important;
  --primary-foreground: 240 10% 3% !important;
  --background: 240 15% 8% !important;
  --foreground: 0 0% 95% !important;
  --card: 240 15% 12% !important;
  --card-foreground: 0 0% 95% !important;
  --popover: 240 15% 12% !important;
  --popover-foreground: 0 0% 95% !important;
  --secondary: 240 10% 25% !important;
  --secondary-foreground: 0 0% 95% !important;
  --muted: 240 10% 30% !important;
  --muted-foreground: 0 0% 60% !important;
  --accent: 300 100% 50% !important;
  --accent-foreground: 240 10% 3% !important;
  --destructive: 0 84% 60% !important;
  --destructive-foreground: 0 0% 98% !important;
  --border: 240 10% 25% !important;
  --input: 240 10% 20% !important;
  --ring: 180 100% 50% !important;
  --radius: 0.5rem !important;
}
button { font-weight: 600 !important; letter-spacing: 0.5px !important; }
button:hover { transform: translateY(-1px) !important; box-shadow: 0 8px 16px rgba(0, 255, 255, 0.2) !important; }
[class*="Card"] { border: 1px solid rgba(0, 255, 255, 0.1) !important; }
:focus-visible { outline: 2px solid hsl(180, 100%, 50%) !important; outline-offset: 2px !important; }
* { transition: color 200ms, background-color 200ms, border-color 200ms !important; }`,
  },
  {
    name: 'Fresh Energy',
    description: 'Bright, wellness-focused theme with greens and blues. Perfect for health tracking and positive vibes.',
    css: `/* Fresh Energy Theme - Wellness & Health Focused */
html:root {
  --primary: 142 72% 29% !important;
  --primary-foreground: 0 0% 98% !important;
  --background: 120 20% 96% !important;
  --foreground: 40 10% 20% !important;
  --card: 0 0% 100% !important;
  --card-foreground: 40 10% 20% !important;
  --popover: 0 0% 100% !important;
  --popover-foreground: 40 10% 20% !important;
  --secondary: 200 90% 56% !important;
  --secondary-foreground: 0 0% 100% !important;
  --muted: 120 10% 90% !important;
  --muted-foreground: 40 5% 45% !important;
  --accent: 180 100% 35% !important;
  --accent-foreground: 0 0% 100% !important;
  --destructive: 0 84% 60% !important;
  --destructive-foreground: 0 0% 98% !important;
  --border: 120 15% 90% !important;
  --input: 120 15% 92% !important;
  --ring: 142 72% 29% !important;
  --radius: 1rem !important;
}
[class*="Card"] { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important; border: 1px solid rgba(142, 184, 92, 0.1) !important; }
button { font-weight: 600 !important; border-radius: 0.75rem !important; }
button:hover { background-color: hsl(142, 72%, 35%) !important; color: white !important; }
input:focus, textarea:focus { border-color: hsl(142, 72%, 29%) !important; box-shadow: 0 0 0 3px rgba(142, 184, 92, 0.1) !important; }`,
  },
  {
    name: 'Elite Focus',
    description: 'Minimalist dark theme with gold accents and premium typography. Perfect for serious athletes and coaches.',
    css: `/* Elite Focus Theme - Premium Minimalist */
html:root {
  --primary: 45 93% 47% !important;
  --primary-foreground: 20 25% 8% !important;
  --background: 20 25% 11% !important;
  --foreground: 0 0% 93% !important;
  --card: 20 20% 15% !important;
  --card-foreground: 0 0% 93% !important;
  --popover: 20 20% 15% !important;
  --popover-foreground: 0 0% 93% !important;
  --secondary: 20 10% 30% !important;
  --secondary-foreground: 0 0% 93% !important;
  --muted: 20 8% 35% !important;
  --muted-foreground: 0 0% 60% !important;
  --accent: 0 0% 70% !important;
  --accent-foreground: 20 25% 8% !important;
  --destructive: 0 84% 60% !important;
  --destructive-foreground: 0 0% 98% !important;
  --border: 45 80% 30% !important;
  --input: 20 15% 20% !important;
  --ring: 45 93% 47% !important;
  --radius: 0.375rem !important;
}
[class*="Card"] { border: 1px solid rgba(212, 175, 55, 0.15) !important; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important; }
button { font-weight: 600 !important; letter-spacing: 0.8px !important; }
button:hover { background-color: hsl(45, 93%, 52%) !important; }
:focus-visible { outline: 2px solid hsl(45, 93%, 47%) !important; outline-offset: 2px !important; }`,
  },
];

export async function seedMarketplaceThemes() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Please sign in first');
    }

    console.log('🎨 Seeding marketplace themes...');

    let successCount = 0;
    for (const theme of premiumThemes) {
      const { data, error } = await supabase
        .from('user_themes')
        .insert({
          name: theme.name,
          description: theme.description,
          css_url: theme.css,
          js_url: null,
          is_public: true,
          user_id: user.id,
          install_count: 0,
          like_count: 0,
        } as any)
        .select();

      if (error) {
        console.warn(`⚠️  Failed to seed "${theme.name}":`, error.message);
      } else {
        console.log(`✅ Seeded: ${theme.name}`);
        successCount++;
      }
    }

    console.log(`\n✨ Successfully seeded ${successCount}/${premiumThemes.length} themes!`);
    return successCount;
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).seedMarketplaceThemes = seedMarketplaceThemes;
}
