import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const THEME_STORAGE_KEY = "nls-active-theme-url";
const JS_STORAGE_KEY = "nls-active-theme-js-url";

export const useTheme = () => {
  const [activeThemeUrl, setActiveThemeUrl] = useState<string | null>(
    () => localStorage.getItem(THEME_STORAGE_KEY)
  );
  const [activeJsUrl, setActiveJsUrl] = useState<string | null>(
    () => localStorage.getItem(JS_STORAGE_KEY)
  );
  const { toast } = useToast();

  // Apply theme CSS to head
  useEffect(() => {
    const existingLink = document.getElementById("user-custom-theme") as HTMLLinkElement | null;

    if (activeThemeUrl) {
      if (existingLink) {
        existingLink.href = activeThemeUrl;
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

  // Persist JS URL
  useEffect(() => {
    if (activeJsUrl) {
      localStorage.setItem(JS_STORAGE_KEY, activeJsUrl);
    } else {
      localStorage.removeItem(JS_STORAGE_KEY);
    }
  }, [activeJsUrl]);

  const applyTheme = useCallback((cssUrl: string | null, jsUrl?: string | null) => {
    setActiveThemeUrl(cssUrl);
    setActiveJsUrl(jsUrl ?? null);
  }, []);

  const clearTheme = useCallback(() => {
    setActiveThemeUrl(null);
    setActiveJsUrl(null);
    toast({ title: "Theme cleared", description: "Default theme restored" });
  }, [toast]);

  return { activeThemeUrl, activeJsUrl, applyTheme, clearTheme };
};
