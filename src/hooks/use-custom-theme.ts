import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const THEME_STORAGE_KEY = "nls-active-theme-url";

export const useTheme = () => {
  const [activeThemeUrl, setActiveThemeUrl] = useState<string | null>(
    () => localStorage.getItem(THEME_STORAGE_KEY)
  );
  const { toast } = useToast();

  // Apply theme CSS to head
  useEffect(() => {
    const existingLink = document.getElementById("user-custom-theme") as HTMLLinkElement | null;

    if (activeThemeUrl) {
      if (existingLink) {
        existingLink.href = activeThemeUrl;
        // Re-append to end of head to ensure it overrides app styles
        document.head.appendChild(existingLink);
      } else {
        const link = document.createElement("link");
        link.id = "user-custom-theme";
        link.rel = "stylesheet";
        link.href = activeThemeUrl;
        document.head.appendChild(link);
      }
      localStorage.setItem(THEME_STORAGE_KEY, activeThemeUrl);
    } else {
      if (existingLink) {
        existingLink.remove();
      }
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [activeThemeUrl]);

  const applyTheme = useCallback((cssUrl: string | null) => {
    setActiveThemeUrl(cssUrl);
  }, []);

  const clearTheme = useCallback(() => {
    setActiveThemeUrl(null);
    toast({ title: "Theme cleared", description: "Default theme restored" });
  }, [toast]);

  return { activeThemeUrl, applyTheme, clearTheme };
};
