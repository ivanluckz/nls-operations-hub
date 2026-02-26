import { Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { useState } from "react";

const DARK_KEY = "nls-dark-mode";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem(DARK_KEY);
    return saved !== null
      ? saved === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(DARK_KEY, String(next));
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={`h-9 w-9 ${className || ""}`}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
