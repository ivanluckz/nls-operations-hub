import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getTheme, type LocalTheme } from "@/lib/local-theme-store";

const ACTIVE_THEME_KEY = "nls-active-theme-id";

export const useTheme = () => {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_THEME_KEY)
  );
  const [activeTheme, setActiveTheme] = useState<LocalTheme | null>(null);
  const { toast } = useToast();

  // Load active theme data from IndexedDB
  useEffect(() => {
    if (activeThemeId) {
      getTheme(activeThemeId).then((theme) => {
        if (theme) {
          setActiveTheme(theme);
        } else {
          // Theme was deleted from IndexedDB
          setActiveThemeId(null);
          setActiveTheme(null);
          localStorage.removeItem(ACTIVE_THEME_KEY);
        }
      });
    } else {
      setActiveTheme(null);
    }
  }, [activeThemeId]);

  // Apply CSS content as inline <style> tag
  useEffect(() => {
    const existingStyle = document.getElementById("user-custom-theme-style");
    const existingLink = document.getElementById("user-custom-theme") as HTMLLinkElement | null;

    // Remove old link-based theme (legacy)
    if (existingLink) existingLink.remove();

    if (activeTheme?.cssContent) {
      if (existingStyle) {
        existingStyle.textContent = activeTheme.cssContent;
        // Re-append to ensure it overrides
        document.head.appendChild(existingStyle);
      } else {
        const style = document.createElement("style");
        style.id = "user-custom-theme-style";
        style.textContent = activeTheme.cssContent;
        document.head.appendChild(style);
      }
      localStorage.setItem(ACTIVE_THEME_KEY, activeTheme.id);
    } else {
      if (existingStyle) existingStyle.remove();
      localStorage.removeItem(ACTIVE_THEME_KEY);
    }
  }, [activeTheme]);

  const applyTheme = useCallback((themeId: string | null) => {
    setActiveThemeId(themeId);
  }, []);

  const clearTheme = useCallback(() => {
    setActiveThemeId(null);
    setActiveTheme(null);
    localStorage.removeItem(ACTIVE_THEME_KEY);
    toast({ title: "Theme cleared", description: "Default theme restored" });
  }, [toast]);

  return {
    activeThemeId,
    activeTheme,
    activeThemeUrl: null as string | null, // legacy compat
    activeJsUrl: activeTheme?.jsContent ? "local" : null,
    applyTheme,
    clearTheme,
  };
};
