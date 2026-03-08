import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlayCircle, Download } from "lucide-react";

const ModeratorAllocations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const { data: logs, error } = await supabase
        .from("allocation_audit_log" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch profile names separately since there's no FK
      const triggerIds = [...new Set((logs || []).map((l: any) => l.triggered_by))];
      let profileMap: Record<string, any> = {};
      if (triggerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", triggerIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }

      const data = (logs || []).map((l: any) => ({
        ...l,
        profiles: profileMap[l.triggered_by] || null,
      }));

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRunAllocation = async () => {
    setRunning(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("allocate-activities", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Success!",
        description: `Allocated ${data.allocated} students to activities`,
      });
      
      await fetchAuditLogs();
      navigate("/moderator");
    } catch (error: any) {
      console.error("Allocation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to run allocation",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/moderator")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Run AI Allocation</CardTitle>
            <CardDescription>
              Process student preferences and allocate activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium">Allocation Process</h4>
              <p className="text-sm text-muted-foreground">
                The AI allocation system will process all submitted preferences and assign students to activities based on their choices and capacity constraints.
              </p>
            </div>
            <Button
              onClick={handleRunAllocation}
              disabled={running}
              className="w-full"
              size="lg"
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {running ? "Running Allocation..." : "Run Allocation"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Allocation History</CardTitle>
            <CardDescription>
              Recent allocation runs and their outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <p className="text-sm text-muted-foreground">Loading history...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allocation history yet</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : log.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Triggered by: {log.profiles?.full_name || "Unknown"}
                    </p>
                    {log.status === "completed" && (
                      <p className="text-sm">
                        <span className="font-medium">
                          {log.allocations_created}
                        </span>{" "}
                        allocations created
                        {log.validation_errors > 0 &&
                          ` (${log.validation_errors} validation errors)`}
                      </p>
                    )}
                    {log.status === "failed" && log.error_message && (
                      <p className="text-sm text-red-600">
                        Error: {log.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ModeratorAllocations;
