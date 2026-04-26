import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Download, Eye, Palette, Sparkles, Users, Heart, Trophy, Crown, Medal,
} from "lucide-react";
import { saveTheme, type LocalTheme } from "@/lib/local-theme-store";
import { useTheme } from "@/hooks/use-custom-theme";

interface PublicTheme {
  id: string;
  name: string;
  description: string | null;
  css_url: string;
  js_url: string | null;
  install_count: number;
  like_count: number;
  user_id: string;
  created_at: string;
  authorName?: string;
}

type SortKey = "top" | "popular" | "new";

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
  const [meId, setMeId] = useState<string>("");
  const [themes, setThemes] = useState<PublicTheme[]>([]);
  const [previews, setPreviews] = useState<Record<string, { css: string; js: string | null; color: string }>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("top");

  const load = useCallback(async (uid?: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_themes")
        .select("id, name, description, css_url, js_url, install_count, like_count, user_id, created_at")
        .eq("is_public", true)
        .limit(100);

      if (error) throw error;
      const list = (data || []) as PublicTheme[];

      const authorIds = Array.from(new Set(list.map(t => t.user_id)));
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name").in("id", authorIds);
        const map = new Map((profs || []).map(p => [p.id, p.full_name]));
        list.forEach(t => { t.authorName = map.get(t.user_id) || "Anonymous"; });
      }
      setThemes(list);

      // Fetch my likes
      if (uid) {
        const { data: likes } = await (supabase as any)
          .from("theme_likes").select("theme_id").eq("user_id", uid);
        setMyLikes(new Set((likes || []).map((l: any) => l.theme_id)));
      }

      // Lazy fetch previews for top 12
      const sorted = [...list].sort((a, b) =>
        (b.like_count + b.install_count * 0.5) - (a.like_count + a.install_count * 0.5)
      );
      const previewMap: Record<string, { css: string; js: string | null; color: string }> = {};
      await Promise.all(sorted.slice(0, 12).map(async (t) => {
        try {
          const css = await (await fetch(t.css_url)).text();
          let js: string | null = null;
          if (t.js_url) {
            try { js = await (await fetch(t.js_url)).text(); } catch (jsErr) {
              console.warn(`Failed to load JS for theme ${t.id}:`, jsErr);
            }
          }
          previewMap[t.id] = { css, js, color: previewColor(css) };
        } catch (err) {
          console.warn(`Failed to load preview for theme ${t.id}:`, err);
        }
      }));
      setPreviews(previewMap);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load themes", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMeId(user.id);
    await load(user?.id);
  })(); }, [load]);

  const toggleLike = async (t: PublicTheme) => {
    if (!meId) { toast({ variant: "destructive", title: "Sign in required" }); return; }
    const liked = myLikes.has(t.id);
    // Optimistic
    setMyLikes(prev => {
      const next = new Set(prev);
      if (liked) next.delete(t.id); else next.add(t.id);
      return next;
    });
    setThemes(prev => prev.map(x => x.id === t.id
      ? { ...x, like_count: Math.max(0, x.like_count + (liked ? -1 : 1)) }
      : x));

    try {
      if (liked) {
        await (supabase as any).from("theme_likes")
          .delete().eq("theme_id", t.id).eq("user_id", meId);
      } else {
        await (supabase as any).from("theme_likes")
          .insert({ theme_id: t.id, user_id: meId });
      }
    } catch (err: any) {
      // Revert on failure
      setMyLikes(prev => {
        const next = new Set(prev);
        if (liked) next.add(t.id); else next.delete(t.id);
        return next;
      });
      setThemes(prev => prev.map(x => x.id === t.id
        ? { ...x, like_count: Math.max(0, x.like_count + (liked ? 1 : -1)) }
        : x));
      toast({ variant: "destructive", title: "Like failed", description: err.message });
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

      // Bump install count via RPC (works for any authenticated user)
      await (supabase as any).rpc("bump_theme_install_count", { _theme_id: t.id });
      setThemes(prev => prev.map(x => x.id === t.id ? { ...x, install_count: x.install_count + 1 } : x));

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

  // Sort themes by selected key
  const sorted = [...themes].sort((a, b) => {
    if (sort === "new") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "popular") return b.install_count - a.install_count;
    // top = combined score
    return (b.like_count * 2 + b.install_count) - (a.like_count * 2 + a.install_count);
  });

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const podiumIcons = [Crown, Trophy, Medal];
  const podiumColors = ["text-amber-500", "text-slate-400", "text-orange-600"];

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Theme Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Discover, like, and install themes by other students.
          </p>
        </div>
      </div>

      <Tabs value={sort} onValueChange={(v) => setSort(v as SortKey)} className="mb-6">
        <TabsList>
          <TabsTrigger value="top" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Top</TabsTrigger>
          <TabsTrigger value="popular" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Most Installed</TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Newest</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No public themes yet</p>
            <p className="text-xs mt-1">Be the first — publish one from your Theme Management page.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Leaderboard podium (only on Top tab) */}
          {sort === "top" && top3.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
              </h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                {top3.map((t, i) => {
                  const Icon = podiumIcons[i];
                  const swatch = previews[t.id]?.color || "hsl(var(--primary))";
                  return (
                    <Card key={t.id} className="overflow-hidden border-2 shadow-md hover:shadow-xl transition-all"
                          style={{ borderColor: i === 0 ? "hsl(43 96% 56%)" : undefined }}>
                      <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${swatch}, ${swatch}88)` }}>
                        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur rounded-full h-8 w-8 flex items-center justify-center shadow">
                          <Icon className={`h-4 w-4 ${podiumColors[i]}`} />
                        </div>
                        <div className="absolute top-2 right-2 bg-background/90 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-bold">
                          #{i + 1}
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                        <p className="text-[11px] text-muted-foreground truncate mb-2">by {t.authorName}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {t.like_count}</span>
                            <span className="flex items-center gap-0.5"><Download className="h-3 w-3" /> {t.install_count}</span>
                          </div>
                          <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => installTheme(t)} disabled={installing === t.id}>
                            Install
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {(sort === "top" ? rest : sorted).map(t => {
              const swatch = previews[t.id]?.color || "hsl(var(--primary))";
              const liked = myLikes.has(t.id);
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <button
                          onClick={() => toggleLike(t)}
                          className={`flex items-center gap-0.5 transition-colors ${liked ? "text-rose-500" : "hover:text-rose-500"}`}
                          title={liked ? "Unlike" : "Like"}
                        >
                          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {t.like_count}
                        </button>
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" /> {t.install_count}
                        </span>
                      </div>
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
        </>
      )}
    </div>
  );
}
