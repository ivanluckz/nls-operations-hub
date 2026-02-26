import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

const THEME_KEY = "nls-preset-theme";

const PRESETS = [
  { id: "default", label: "NLS Red", color: "#c0303a", desc: "Classic" },
  { id: "ocean",   label: "Ocean",   color: "#1d9aaa", desc: "Teal" },
  { id: "sunset",  label: "Sunset",  color: "#e86820", desc: "Orange" },
  { id: "forest",  label: "Forest",  color: "#2d8a4e", desc: "Green" },
  { id: "purple",  label: "Purple",  color: "#7c3aed", desc: "Violet" },
  { id: "rose",    label: "Rose",    color: "#d03070", desc: "Pink" },
];

export function ThemePicker() {
  const [active, setActive] = useState<string>(() => {
    return localStorage.getItem(THEME_KEY) || "default";
  });

  const apply = (id: string) => {
    setActive(id);
    localStorage.setItem(THEME_KEY, id);
    if (id === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", id);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Pick a color theme">
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Color Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => apply(p.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                active === p.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <div
                className="w-7 h-7 rounded-full shadow-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[10px] font-medium leading-tight">{p.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
