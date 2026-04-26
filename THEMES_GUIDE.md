# NLS Themes Guide

## 🎨 Available Premium Themes

### 1. **Midnight Athlete** 🌙
**Best for:** Athletes who love dark mode, night studying, focus sessions

**Color Scheme:**
- Primary: Electric Cyan (HSL 180 100% 50%)
- Accent: Electric Magenta (HSL 300 100% 50%)
- Background: Deep Navy (HSL 240 15% 8%)
- Foreground: Off-white (0 0% 95%)

**Features:**
- High contrast for better focus
- Neon grid animation in background
- Smooth button transitions with glow effects
- Perfect for competitive athletes

**Example Use Cases:**
- Late-night training sessions
- Intense focus work
- Competitive gaming/sports
- Student athletes studying at night

---

### 2. **Fresh Energy** 🌿
**Best for:** Wellness enthusiasts, health-conscious students, teachers

**Color Scheme:**
- Primary: Forest Green (HSL 142 72% 29%)
- Secondary: Sky Blue (HSL 200 90% 56%)
- Background: Off-white (HSL 120 20% 96%)
- Accent: Vibrant Teal (HSL 180 100% 35%)

**Features:**
- Calming organic color palette
- Animated bubbles and waves
- Soft shadows and rounded corners
- Encourages positive engagement

**Example Use Cases:**
- Health and wellness tracking
- Teacher dashboards
- Mental health awareness
- Mindfulness and meditation apps
- General student use

---

### 3. **Elite Focus** 🏆
**Best for:** Coaches, administrators, premium feel seekers

**Color Scheme:**
- Primary: Deep Gold (HSL 45 93% 47%)
- Background: Charcoal (HSL 20 25% 11%)
- Accent: Silver (0 0% 70%)
- Premium typography

**Features:**
- Minimalist & sophisticated
- Premium gold accents
- Perfect corner radius (0.375rem)
- Premium smooth transitions
- Professional button styling

**Example Use Cases:**
- Coach dashboards
- Admin panels
- Premium user experience
- Formal settings
- Leadership presentations

---

## 🚀 How to Add Themes to Marketplace

### Option 1: Browser Console (Easiest)

1. **Sign in as an admin or teacher**
   - Go to the app and log in with your admin account

2. **Open Browser Console**
   - Press `F12` or `Ctrl+Shift+J` (Windows)
   - Press `Cmd+Option+J` (Mac)

3. **Run the Seeding Function**
   ```javascript
   seedMarketplaceThemes()
   ```

4. **Check Console Output**
   ```
   ✅ Seeded: Midnight Athlete
   ✅ Seeded: Fresh Energy
   ✅ Seeded: Elite Focus
   ✨ Successfully seeded 3/3 themes!
   ```

5. **View in Marketplace**
   - Navigate to `/themes/marketplace`
   - All three themes should appear
   - Users can click "Install" to apply

---

### Option 2: Direct Database Insert

Run this SQL in your Supabase SQL editor:

```sql
-- Get an admin user ID first
SELECT id FROM auth.users WHERE email = 'admin@example.com' LIMIT 1;

-- Then insert themes (replace 'admin-user-id' with the ID from above)
INSERT INTO public.user_themes (name, description, css_url, js_url, is_public, user_id, install_count, like_count)
VALUES 
('Midnight Athlete', 'Dark, energetic theme with neon accents...', 'css_content_here', 'js_content_here', true, 'admin-user-id', 0, 0),
('Fresh Energy', 'Bright, wellness-focused theme...', 'css_content_here', NULL, true, 'admin-user-id', 0, 0),
('Elite Focus', 'Minimalist dark theme with gold accents...', 'css_content_here', NULL, true, 'admin-user-id', 0, 0);
```

---

## 🎯 Workout Attendance Improvements

### New Features:

1. **Overall Attendance Progress Bar**
   - Located in the card header
   - Shows `X/Y (Z%)` format
   - Green progress indicator

2. **Per-Workout Progress Bars**
   - Below each workout section
   - Individual attendance rates
   - Blue progress bars

3. **Enhanced Status Indicators**
   - Present: Green badge with checkmark + animation
   - Medical: Blue pulsing badge
   - Excused: Amber outline badge
   - Unmarked: "Mark ✓" button with hover effect

4. **Better Button Feedback**
   - Hover elevation effect
   - Loading state shows "..."
   - Smooth color transitions
   - Keyboard accessible

---

## 🧪 Testing the Themes

### Test Midnight Athlete
1. Install the theme
2. Notice the cyan and magenta colors
3. Look for the neon grid animation
4. Test at night for the dark mode effect

### Test Fresh Energy
1. Install the theme
2. Observe the calming green and blue
3. Watch the bubble animations
4. Try filling out forms - notice the soft focus effect

### Test Elite Focus
1. Install the theme
2. Appreciate the gold accents
3. Notice the premium typography
4. Use it in an admin/coach context

---

## 📊 Theme Usage Analytics

After seeding, you can track:
- Install count
- Like count
- User feedback
- Theme popularity

View theme stats in `/admin/co-curricular/messages` (if available)

---

## 🛠️ Customizing Themes

### To Create New Themes:

1. **Create CSS File**
   - Use HSL color format with `!important`
   - Reference `public/themes/midnight-athlete.css`
   - Include all CSS variables from template

2. **Create JS Animation** (Optional)
   - Canvas-based animation
   - Reference `public/themes/neon-pulse.js`
   - Receives `canvas` and `ctx` globals

3. **Add to Seed Function**
   - Edit `src/lib/seed-theme-marketplace.ts`
   - Add to `premiumThemes` array
   - Re-run `seedMarketplaceThemes()`

---

## ✨ Tips & Best Practices

- **For Athletes:** Use Midnight Athlete for better focus during workouts
- **For Teachers:** Use Fresh Energy to create a welcoming classroom atmosphere
- **For Admins:** Use Elite Focus for a professional, premium look
- **Mobile:** All themes are responsive and mobile-friendly
- **Accessibility:** All themes maintain WCAG contrast ratios

---

## 🐛 Troubleshooting

### Themes not appearing after seeding?
1. Clear browser cache (`Ctrl+Shift+Delete`)
2. Refresh the page
3. Check browser console for errors
4. Verify you're signed in as admin

### Theme colors look wrong?
1. Hard refresh the page (`Ctrl+Shift+R`)
2. Clear IndexedDB in DevTools
3. Uninstall and reinstall theme
4. Check system dark mode setting

### Animations not playing?
1. Check browser console for JS errors
2. Verify hardware acceleration is enabled
3. Try a different browser
4. Check if browser blocks canvas animations

---

## 📞 Support

For issues with:
- **Theme creation:** Check CSS HSL format
- **Seeding:** Ensure you're signed in as admin
- **Display:** Clear cache and refresh
- **Performance:** Disable animations if needed

---

**Last Updated:** April 2026
**Created by:** Claude Code
**Version:** 1.0
