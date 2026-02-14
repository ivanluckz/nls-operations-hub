import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Upload, Trash2, Palette, Check, Eye, X, Loader2, Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-custom-theme";

interface ThemeRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  css_url: string;
  is_active: boolean;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const MAX_CSS_SIZE = 100 * 1024; // 100KB max

const SAMPLE_CSS = `/* NLS Custom Theme Example */
/* IMPORTANT: Use html:root and !important to override app styles */

html:root {
  --primary: 220 70% 50% !important;         /* Main brand color */
  --primary-foreground: 0 0% 100% !important;
  --background: 220 20% 97% !important;       /* Page background */
  --foreground: 220 20% 10% !important;       /* Text color */
  --card: 0 0% 100% !important;               /* Card background */
  --card-foreground: 220 20% 10% !important;
  --popover: 0 0% 100% !important;
  --popover-foreground: 220 20% 10% !important;
  --secondary: 220 15% 92% !important;
  --secondary-foreground: 220 20% 15% !important;
  --muted: 220 15% 92% !important;            /* Muted backgrounds */
  --muted-foreground: 220 10% 40% !important;
  --accent: 340 65% 55% !important;           /* Accent color */
  --accent-foreground: 0 0% 100% !important;
  --destructive: 0 70% 50% !important;
  --destructive-foreground: 0 0% 98% !important;
  --border: 220 15% 85% !important;           /* Border color */
  --input: 220 15% 85% !important;
  --ring: 220 70% 50% !important;             /* Focus ring */
  --radius: 0.75rem !important;               /* Border radius */
  --sidebar-background: 220 20% 97% !important;
  --sidebar-foreground: 220 20% 10% !important;
  --sidebar-primary: 220 70% 50% !important;
  --sidebar-primary-foreground: 0 0% 100% !important;
  --sidebar-accent: 220 15% 92% !important;
  --sidebar-accent-foreground: 220 20% 15% !important;
  --sidebar-border: 220 15% 85% !important;
  --sidebar-ring: 220 70% 50% !important;
}`;

const ThemeManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeThemeUrl, applyTheme, clearTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [themeDesc, setThemeDesc] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      await fetchThemes();
    };
    init();
  }, []);

  const fetchThemes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_themes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setThemes((data as ThemeRecord[]) || []);
    } catch (error) {
      console.error("Failed to fetch themes:", error);
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
      const content = ev.target?.result as string;
      setCssContent(content);
      if (!themeName) setThemeName(file.name.replace('.css', ''));
    };
    reader.readAsText(file);
  };

  const handleUploadTheme = async () => {
    if (!themeName.trim() || !cssContent.trim() || !userId) {
      toast({ title: "Missing info", description: "Theme name and CSS content are required", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      // Upload CSS file to storage
      const fileName = `${userId}/${Date.now()}-${themeName.replace(/[^a-zA-Z0-9]/g, '-')}.css`;
      const blob = new Blob([cssContent], { type: 'text/css' });

      const { error: uploadError } = await supabase.storage
        .from('themes')
        .upload(fileName, blob, { contentType: 'text/css', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('themes').getPublicUrl(fileName);

      // Save theme record
      const { error: insertError } = await supabase
        .from('user_themes')
        .insert({
          user_id: userId,
          name: themeName.trim(),
          description: themeDesc.trim() || null,
          css_url: urlData.publicUrl,
        });

      if (insertError) throw insertError;

      toast({ title: "Theme uploaded!", description: `"${themeName}" is now available` });
      setThemeName("");
      setThemeDesc("");
      setCssContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchThemes();
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTheme = async (theme: ThemeRecord) => {
    try {
      // Remove from active if currently applied
      if (activeThemeUrl === theme.css_url) {
        clearTheme();
      }

      // Extract path from URL for storage deletion
      const urlParts = theme.css_url.split('/themes/');
      if (urlParts[1]) {
        await supabase.storage.from('themes').remove([decodeURIComponent(urlParts[1])]);
      }

      const { error } = await supabase.from('user_themes').delete().eq('id', theme.id);
      if (error) throw error;

      toast({ title: "Theme deleted" });
      await fetchThemes();
    } catch (error) {
      console.error("Delete error:", error);
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handlePreview = (cssUrl: string) => {
    if (previewUrl === cssUrl) {
      setPreviewUrl(null);
      // Restore active theme or clear
      applyTheme(activeThemeUrl);
    } else {
      setPreviewUrl(cssUrl);
      applyTheme(cssUrl);
    }
  };

  const handleApply = (cssUrl: string) => {
    applyTheme(cssUrl);
    setPreviewUrl(null);
    toast({ title: "Theme applied!", description: "Your custom theme is now active" });
  };

  const loadSample = () => {
    setCssContent(SAMPLE_CSS);
    setThemeName("My Custom Theme");
    setThemeDesc("A custom color scheme");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Custom Themes</h1>
            <p className="text-sm text-muted-foreground">Upload CSS files to personalize your experience</p>
          </div>
        </div>

        {/* Active theme banner */}
        {activeThemeUrl && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Custom theme active</span>
              </div>
              <Button variant="outline" size="sm" onClick={clearTheme}>
                <X className="h-3 w-3 mr-1" /> Reset to default
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Theme</CardTitle>
              <CardDescription>
                Upload a .css file to create a custom theme. 
                <Button variant="link" size="sm" className="px-1 h-auto" onClick={loadSample}>
                  Load sample CSS
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme-name">Theme Name</Label>
                <Input
                  id="theme-name"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="My Cool Theme"
                  maxLength={50}
                />
              </div>
              <div>
                <Label htmlFor="theme-desc">Description (optional)</Label>
                <Input
                  id="theme-desc"
                  value={themeDesc}
                  onChange={(e) => setThemeDesc(e.target.value)}
                  placeholder="Dark blue with warm accents"
                  maxLength={200}
                />
              </div>
              <div>
                <Label htmlFor="css-file">CSS File</Label>
                <Input
                  id="css-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".css"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>
              {cssContent && (
                <div>
                  <Label>CSS Preview</Label>
                  <Textarea
                    value={cssContent}
                    onChange={(e) => setCssContent(e.target.value)}
                    className="font-mono text-xs h-40"
                    placeholder="Paste CSS here or upload a file..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {cssContent.length.toLocaleString()} chars • {(new Blob([cssContent]).size / 1024).toFixed(1)}KB
                  </p>
                </div>
              )}
              {!cssContent && (
                <Textarea
                  value={cssContent}
                  onChange={(e) => setCssContent(e.target.value)}
                  className="font-mono text-xs h-24"
                  placeholder="Or paste CSS directly here..."
                />
              )}
              <Button
                onClick={handleUploadTheme}
                disabled={isUploading || !themeName.trim() || !cssContent.trim()}
                className="w-full"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Theme
              </Button>
            </CardContent>
          </Card>

          {/* Theme gallery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Theme Gallery</CardTitle>
              <CardDescription>
                {themes.length} theme{themes.length !== 1 ? 's' : ''} available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : themes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Palette className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No themes yet</p>
                    <p className="text-xs mt-1">Upload your first CSS theme!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {themes.map((theme) => {
                      const isActive = activeThemeUrl === theme.css_url;
                      const isPreviewing = previewUrl === theme.css_url;
                      const isOwn = theme.user_id === userId;

                      return (
                        <div
                          key={theme.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{theme.name}</span>
                                {isActive && <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>}
                                {isOwn && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Yours</Badge>}
                              </div>
                              {theme.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{theme.description}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(theme.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <Button
                              variant={isPreviewing ? "secondary" : "outline"}
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handlePreview(theme.css_url)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {isPreviewing ? "Stop" : "Preview"}
                            </Button>
                            <Button
                              variant={isActive ? "secondary" : "default"}
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleApply(theme.css_url)}
                              disabled={isActive}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {isActive ? "Applied" : "Apply"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => window.open(theme.css_url, '_blank')}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            {isOwn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteTheme(theme)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
