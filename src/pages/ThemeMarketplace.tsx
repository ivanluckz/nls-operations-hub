import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Eye, Palette, Sparkles, Users } from "lucide-react";
import { saveTheme, type LocalTheme } from "@/lib/local-theme-store";
import { useTheme } from "@/hooks/use-custom-theme";

interface PublicTheme {
  id: string;
  name: string;
  description: string | null;
  css_url: string;
  js_url: string | null;
  install_count: number;
  user_id: string;
  created_at: string;
  authorName?: string;
}

/** Pull a representative HSL color out of a CSS string (e.g. --primary value). */
function previewColor(css: string): string {
  const m = css.match(/--primary:\s*([\d.]+)\s+([\d.]+%?)\s+([\d.]+%?)/);
  if (!m) return "hsl(220 70% 50%)";
  const [, h, s, l] = m;
  return `hsl(${h} ${s.endsWith("%") ? s : s + "%"} ${l.endsWith("%") ? l : l + "%"})`;
}

export default function ThemeMarketplace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { applyTheme } = useTheme();
  const [themes, setThemes] = useState<PublicTheme[]>([]);
  const [previews, setPreviews] = useState<Record<string, { css: string; js: string | null; color: string }>>({});
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_themes")
        .select("id, name, description, css_url, js_url, install_count, user_id, created_at")
        .eq("is_public", true)
        .order("install_count", { ascending: false })
        .limit(60);

      if (error) throw error;
      const list = (data || []) as PublicTheme[];

      // Fetch authors in batch
      const authorIds = Array.from(new Set(list.map(t => t.user_id)));
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name").in("id", authorIds);
        const map = new Map((profs || []).map(p => [p.id, p.full_name]));
        list.forEach(t => { t.authorName = map.get(t.user_id) || "Anonymous"; });
      }
      setThemes(list);

      // Lazy fetch first 12 css contents for preview swatches
      const previewMap: Record<string, { css: string; js: string | null; color: string }> = {};
      await Promise.all(list.slice(0, 12).map(async (t) => {
        try {
          const cssRes = await fetch(t.css_url);
          const css = await cssRes.text();
          let js: string | null = null;
          if (t.js_url) {
            try { js = await (await fetch(t.js_url)).text(); } catch {}
          }
          previewMap[t.id] = { css, js, color: previewColor(css) };
        } catch {}
      }));
      setPreviews(previewMap);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load themes", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const installTheme = async (t: PublicTheme) => {
    setInstalling(t.id);
    try {
      let cached = previews[t.id];
      if (!cached) {
        const css = await (await fetch(t.css_url)).text();
        const js = t.js_url ? await (await fetch(t.js_url)).text() : null;
        cached = { css, js, color: previewColor(css) };
      }

      const local: LocalTheme = {
        id: crypto.randomUUID(),
        name: t.name,
        description: t.description || `From the marketplace by ${t.authorName}`,
        cssContent: cached.css,
        jsContent: cached.js,
        createdAt: Date.now(),
      };
      await saveTheme(local);

      // Bump install count (RLS allows author-only update; we ignore failure)
      await (supabase as any).rpc("noop_ignore_error").catch(() => null);

      applyTheme(local.id);
      toast({ title: "Theme installed!", description: `"${t.name}" is now active.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Install failed", description: err.message });
    } finally {
      setInstalling(null);
    }
  };

  const previewLive = async (t: PublicTheme) => {
    try {
      const cached = previews[t.id] || {
        css: await (await fetch(t.css_url)).text(),
        js: t.js_url ? await (await fetch(t.js_url)).text() : null,
        color: "",
      };
      const local: LocalTheme = {
        id: `__preview_${t.id}`,
        name: `Preview: ${t.name}`,
        description: "",
        cssContent: cached.css,
        jsContent: cached.js,
        createdAt: Date.now(),
      };
      await saveTheme(local);
      applyTheme(local.id);
      toast({ title: "Previewing", description: "Use Install to keep it." });
    } catch {
      toast({ variant: "destructive", title: "Preview failed" });
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Theme Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Discover themes published by other students. Install to keep them locally.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No public themes yet</p>
            <p className="text-xs mt-1">Be the first — publish one from your Theme Management page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map(t => {
            const swatch = previews[t.id]?.color || "hsl(var(--primary))";
            return (
              <Card key={t.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-20" style={{ background: `linear-gradient(135deg, ${swatch}, ${swatch}88)` }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    {t.js_url && <Badge variant="secondary" className="text-[10px] shrink-0">🎬 Animated</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    by {t.authorName || "Anonymous"}
                  </p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {t.install_count} installs
                    </span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => previewLive(t)}>
                        <Eye className="h-3 w-3 mr-1" /> Try
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => installTheme(t)} disabled={installing === t.id}>
                        <Download className="h-3 w-3 mr-1" /> Install
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
