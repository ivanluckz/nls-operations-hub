import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Upload, Trash2, Palette, Check, Eye, X, Loader2, Code, HardDrive
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-custom-theme";
import {
  saveTheme, getAllThemes, deleteTheme as deleteLocalTheme,
  type LocalTheme
} from "@/lib/local-theme-store";

const MAX_CSS_SIZE = 100 * 1024;
const MAX_JS_SIZE = 50 * 1024;

const SAMPLE_CSS = `/* NLS Custom Theme Example */
/* IMPORTANT: Use html:root and !important to override app styles */

html:root {
  --primary: 220 70% 50% !important;
  --primary-foreground: 0 0% 100% !important;
  --background: 220 20% 97% !important;
  --foreground: 220 20% 10% !important;
  --card: 0 0% 100% !important;
  --card-foreground: 220 20% 10% !important;
  --popover: 0 0% 100% !important;
  --popover-foreground: 220 20% 10% !important;
  --secondary: 220 15% 92% !important;
  --secondary-foreground: 220 20% 15% !important;
  --muted: 220 15% 92% !important;
  --muted-foreground: 220 10% 40% !important;
  --accent: 340 65% 55% !important;
  --accent-foreground: 0 0% 100% !important;
  --destructive: 0 70% 50% !important;
  --destructive-foreground: 0 0% 98% !important;
  --border: 220 15% 85% !important;
  --input: 220 15% 85% !important;
  --ring: 220 70% 50% !important;
  --radius: 0.75rem !important;
}`;

const SAMPLE_JS = `// Animation script — you get canvas + ctx globals
const chars = '01';
const fontSize = 14;
const columns = Math.floor(canvas.width / fontSize);
const drops = Array.from({ length: columns }, () => Math.random() * -100);

function draw() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSize + 'px monospace';
  for (let i = 0; i < columns; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    const x = i * fontSize;
    const y = drops[i] * fontSize;
    ctx.fillStyle = 'hsl(120, 100%, ' + (50 + Math.random() * 30) + '%)';
    ctx.fillText(char, x, y);
    drops[i] += 0.05 + Math.random() * 0.08;
    if (y > canvas.height && Math.random() > 0.98) drops[i] = Math.random() * -20;
  }
  requestAnimationFrame(draw);
}
draw();`;

const ThemeManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeThemeId, activeTheme, applyTheme, clearTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsFileInputRef = useRef<HTMLInputElement>(null);

  const [themes, setThemes] = useState<LocalTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [themeName, setThemeName] = useState("");
  const [themeDesc, setThemeDesc] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [jsContent, setJsContent] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    setIsLoading(true);
    try {
      const all = await getAllThemes();
      setThemes(all);
    } catch (error) {
      console.error("Failed to load themes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.css')) {
      toast({ title: "Invalid file", description: "Please upload a .css file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_CSS_SIZE) {
      toast({ title: "File too large", description: "CSS file must be under 100KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCssContent(ev.target?.result as string);
      if (!themeName) setThemeName(file.name.replace('.css', ''));
    };
    reader.readAsText(file);
  };

  const handleJsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.js')) {
      toast({ title: "Invalid file", description: "Please upload a .js file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_JS_SIZE) {
      toast({ title: "File too large", description: "JS file must be under 50KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setJsContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleSaveTheme = async () => {
    if (!themeName.trim() || !cssContent.trim()) {
      toast({ title: "Missing info", description: "Theme name and CSS are required", variant: "destructive" });
      return;
    }

    try {
      const theme: LocalTheme = {
        id: crypto.randomUUID(),
        name: themeName.trim(),
        description: themeDesc.trim(),
        cssContent: cssContent,
        jsContent: jsContent.trim() || null,
        createdAt: Date.now(),
      };

      await saveTheme(theme);
      toast({ title: "Theme saved!", description: `"${themeName}" saved to your browser` });
      setThemeName("");
      setThemeDesc("");
      setCssContent("");
      setJsContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (jsFileInputRef.current) jsFileInputRef.current.value = "";
      await loadThemes();
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleDeleteTheme = async (theme: LocalTheme) => {
    try {
      if (activeThemeId === theme.id) clearTheme();
      await deleteLocalTheme(theme.id);
      toast({ title: "Theme deleted" });
      await loadThemes();
    } catch (error) {
      console.error("Delete error:", error);
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handlePreview = (theme: LocalTheme) => {
    if (previewId === theme.id) {
      setPreviewId(null);
      if (activeThemeId) {
        applyTheme(activeThemeId);
      } else {
        clearTheme();
      }
    } else {
      setPreviewId(theme.id);
      applyTheme(theme.id);
    }
  };

  const handleApply = (theme: LocalTheme) => {
    applyTheme(theme.id);
    setPreviewId(null);
    toast({ title: "Theme applied!", description: "Your custom theme is now active" });
  };

  const handleExport = (theme: LocalTheme) => {
    const data = JSON.stringify({
      name: theme.name,
      description: theme.description,
      cssContent: theme.cssContent,
      jsContent: theme.jsContent,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.replace(/[^a-zA-Z0-9]/g, '-')}.theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.cssContent || !data.name) {
          toast({ title: "Invalid theme file", variant: "destructive" });
          return;
        }
        const theme: LocalTheme = {
          id: crypto.randomUUID(),
          name: data.name,
          description: data.description || "",
          cssContent: data.cssContent,
          jsContent: data.jsContent || null,
          createdAt: Date.now(),
        };
        await saveTheme(theme);
        toast({ title: "Theme imported!", description: `"${theme.name}" loaded` });
        await loadThemes();
      } catch {
        toast({ title: "Invalid file", description: "Could not parse theme JSON", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Custom Themes</h1>
            <p className="text-sm text-muted-foreground">
              <HardDrive className="h-3 w-3 inline mr-1" />
              Stored locally in your browser — no cloud space used
            </p>
          </div>
        </div>

        {activeThemeId && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {activeTheme?.name || "Custom theme"} active
                </span>
                {activeTheme?.jsContent && <Badge variant="outline" className="text-[10px]">+ Animation</Badge>}
              </div>
              <Button variant="outline" size="sm" onClick={clearTheme}>
                <X className="h-3 w-3 mr-1" /> Reset
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create / Import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create Theme</CardTitle>
              <CardDescription>
                Upload CSS + optional JS animation.{" "}
                <Button variant="link" size="sm" className="px-1 h-auto" onClick={() => { setCssContent(SAMPLE_CSS); setThemeName("My Custom Theme"); }}>
                  Load sample CSS
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme-name">Theme Name</Label>
                <Input id="theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="My Cool Theme" maxLength={50} />
              </div>
              <div>
                <Label htmlFor="theme-desc">Description (optional)</Label>
                <Input id="theme-desc" value={themeDesc} onChange={(e) => setThemeDesc(e.target.value)} placeholder="Dark blue with warm accents" maxLength={200} />
              </div>
              <div>
                <Label htmlFor="css-file">CSS File</Label>
                <Input id="css-file" ref={fileInputRef} type="file" accept=".css" onChange={handleFileUpload} className="cursor-pointer" />
              </div>
              <Textarea
                value={cssContent}
                onChange={(e) => setCssContent(e.target.value)}
                className="font-mono text-xs h-32"
                placeholder="Paste CSS or upload a file..."
              />
              {cssContent && (
                <p className="text-xs text-muted-foreground">
                  {(new Blob([cssContent]).size / 1024).toFixed(1)}KB
                </p>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5" /> Animation JS (optional)
                  </Label>
                  <Button variant="link" size="sm" className="px-1 h-auto text-xs" onClick={() => setJsContent(SAMPLE_JS)}>
                    Load sample
                  </Button>
                </div>
                <Input ref={jsFileInputRef} type="file" accept=".js" onChange={handleJsFileUpload} className="cursor-pointer" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Runs sandboxed — no access to your data. Gets <code>canvas</code> + <code>ctx</code>.
                </p>
                {jsContent && (
                  <Textarea value={jsContent} onChange={(e) => setJsContent(e.target.value)} className="font-mono text-xs h-24 mt-2" />
                )}
              </div>

              <Button onClick={handleSaveTheme} disabled={!themeName.trim() || !cssContent.trim()} className="w-full">
                <HardDrive className="h-4 w-4 mr-2" /> Save to Browser
              </Button>

              <div className="border-t pt-3">
                <Label htmlFor="import-json" className="text-xs text-muted-foreground cursor-pointer">
                  Import .theme.json file
                </Label>
                <Input id="import-json" type="file" accept=".json" onChange={handleImportJson} className="cursor-pointer mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Gallery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Themes</CardTitle>
              <CardDescription>{themes.length} theme{themes.length !== 1 ? 's' : ''} saved locally</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : themes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Palette className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No themes yet</p>
                    <p className="text-xs mt-1">Create or import your first theme!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {themes.map((theme) => {
                      const isActive = activeThemeId === theme.id;
                      const isPreviewing = previewId === theme.id;

                      return (
                        <div
                          key={theme.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{theme.name}</span>
                              {isActive && <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>}
                              {theme.jsContent && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🎬 Animated</Badge>}
                            </div>
                            {theme.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{theme.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(theme.createdAt).toLocaleDateString()} • {(new Blob([theme.cssContent]).size / 1024).toFixed(1)}KB
                            </p>
                          </div>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            <Button variant={isPreviewing ? "secondary" : "outline"} size="sm" className="text-xs h-7" onClick={() => handlePreview(theme)}>
                              <Eye className="h-3 w-3 mr-1" />
                              {isPreviewing ? "Stop" : "Preview"}
                            </Button>
                            <Button variant={isActive ? "secondary" : "default"} size="sm" className="text-xs h-7" onClick={() => handleApply(theme)} disabled={isActive}>
                              <Check className="h-3 w-3 mr-1" />
                              {isActive ? "Applied" : "Apply"}
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleExport(theme)}>
                              Export
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => handleDeleteTheme(theme)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ThemeManagement;
