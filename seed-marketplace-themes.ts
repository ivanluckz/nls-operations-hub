/**
 * Seed script to add premium themes to the marketplace
 * Run: npx ts-node seed-marketplace-themes.ts
 * Or add a theme manually through the UI
 */

import { supabase } from './src/integrations/supabase/client';
import * as fs from 'fs';
import * as path from 'path';

const THEMES = [
  {
    name: 'Midnight Athlete',
    description: 'Dark, energetic theme with neon cyan and magenta accents. Perfect for focused athletes who want high contrast and electric energy.',
    cssFile: 'public/themes/midnight-athlete.css',
    jsFile: 'public/themes/neon-pulse.js',
  },
  {
    name: 'Fresh Energy',
    description: 'Bright, wellness-focused theme with greens and blues. Perfect for health tracking and positive vibes.',
    cssFile: 'public/themes/fresh-energy.css',
    jsFile: 'public/themes/wellness-animation.js',
  },
  {
    name: 'Elite Focus',
    description: 'Minimalist dark theme with gold accents and premium typography. Perfect for serious athletes and coaches.',
    cssFile: 'public/themes/elite-focus.css',
    jsFile: null,
  },
];

async function seedThemes() {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      console.log('Please sign in first before seeding themes.');
      return;
    }

    console.log(`Seeding themes for user: ${user.email}`);

    for (const theme of THEMES) {
      try {
        // Read CSS file
        const cssPath = path.join(process.cwd(), theme.cssFile);
        const cssContent = fs.readFileSync(cssPath, 'utf-8');

        // Read JS file if present
        let jsContent = null;
        if (theme.jsFile) {
          const jsPath = path.join(process.cwd(), theme.jsFile);
          jsContent = fs.readFileSync(jsPath, 'utf-8');
        }

        // Insert theme into marketplace
        const { data, error } = await supabase
          .from('user_themes')
          .insert({
            name: theme.name,
            description: theme.description,
            css_url: cssContent,
            js_url: jsContent,
            is_public: true,
            user_id: user.id,
            install_count: 0,
            like_count: 0,
          } as any)
          .select();

        if (error) {
          console.error(`Error inserting theme "${theme.name}":`, error);
        } else {
          console.log(`✅ Successfully seeded theme: ${theme.name}`);
          console.log(`   ID: ${data?.[0]?.id}`);
        }
      } catch (err) {
        console.error(`Error processing theme "${theme.name}":`, err);
      }
    }

    console.log('\n✨ Theme seeding completed!');
  } catch (error) {
    console.error('Seed script error:', error);
    process.exit(1);
  }
}

seedThemes();
