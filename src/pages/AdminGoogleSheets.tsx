import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Save, ExternalLink, Sheet } from "lucide-react";

const KEYS = {
  workouts: "gsheet_workouts_id",
  activities: "gsheet_activities_id",
} as const;

type Kind = keyof typeof KEYS;

function extractId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

export default function AdminGoogleSheets() {
  const { toast } = useToast();
  const [workoutsId, setWorkoutsId] = useState("");
  const [activitiesId, setActivitiesId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [syncing, setSyncing] = useState<Kind | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("integration_settings")
        .select("key,value")
        .in("key", [KEYS.workouts, KEYS.activities]);
      const map = new Map((data || []).map((r: any) => [r.key, r.value]));
      setWorkoutsId(map.get(KEYS.workouts) || "");
      setActivitiesId(map.get(KEYS.activities) || "");
      setLoading(false);
    })();
  }, []);

  const save = async (kind: Kind, raw: string) => {
    setSaving(kind);
    const id = extractId(raw);
    const { error } = await supabase
      .from("integration_settings")
      .update({ value: id || null, updated_at: new Date().toISOString() })
      .eq("key", KEYS[kind]);
    setSaving(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    if (kind === "workouts") setWorkoutsId(id);
    else setActivitiesId(id);
    toast({ title: "Saved", description: `${kind} sheet ID updated.` });
  };

  const syncNow = async (kind: Kind) => {
    setSyncing(kind);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheets", {
        body: { kind },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Unknown error");
      toast({ title: "Synced", description: `${data.rows} rows written to Google Sheet.` });
    } catch (e: any) {
      toast({
        title: "Sync failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const renderCard = (kind: Kind, label: string, description: string, value: string, setValue: (v: string) => void) => {
    const sheetUrl = value ? `https://docs.google.com/spreadsheets/d/${value}/edit` : "";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5 text-primary" /> {label}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor={`id-${kind}`}>Spreadsheet URL or ID</Label>
            <Input
              id={`id-${kind}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              The connected Google account must have edit access to this sheet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(kind, value)} disabled={saving === kind || loading} size="sm">
              {saving === kind ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button
              onClick={() => syncNow(kind)}
              disabled={syncing === kind || !value}
              size="sm"
              variant="secondary"
            >
              {syncing === kind ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync now
            </Button>
            {sheetUrl && (
              <Button asChild size="sm" variant="ghost">
                <a href={sheetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Open sheet
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="Google Sheets Sync" description="Live-sync workouts and activities to Google Sheets">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Paste a Google Sheets URL (or ID) for each module. The current state is overwritten into <code>Sheet1</code>{" "}
              every time anyone changes a signup or allocation. The sheet must be shared with edit access to the
              connected Google account.
            </CardDescription>
          </CardHeader>
        </Card>

        {renderCard(
          "workouts",
          "Morning Workouts",
          "All workout signups, teachers, and capacity.",
          workoutsId,
          setWorkoutsId
        )}
        {renderCard(
          "activities",
          "Co-Curricular Activities",
          "All activity allocations with day, slot, and teacher.",
          activitiesId,
          setActivitiesId
        )}
      </div>
    </AdminLayout>
  );
}
