import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Calendar, Users, BookOpen, RefreshCw } from "lucide-react";
import FloatingChatButton from "@/components/student/FloatingChatButton";

interface SummaryData {
  summary: string;
  statistics: { totalIssues: number; absent: number; late: number; excused: number };
  dateRange: { start: string; end: string };
  repeatOffenders: { name: string; count: number }[];
  problematicSubjects: { name: string; count: number }[];
}

const AcademicWeeklySummary = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-academic-weekly-summary");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setSummaryData(data);
      toast({ title: "Summary Generated", description: "Academic weekly summary generated successfully." });
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: "Error", description: error.message || "Failed to generate summary.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Academic AI Weekly Summary
          </h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered analysis of academic attendance trends</p>
        </div>

        {!summaryData && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Generate Academic Summary</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Analyze the past week's academic attendance data to identify repeat absentees, problematic subjects, and trends.
              </p>
              <Button onClick={generateSummary} size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />Generate Summary
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-4">
            <Card><CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-4 w-20" /></CardContent></Card>)}
            </div>
          </div>
        )}

        {summaryData && !loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{summaryData.dateRange.start} – {summaryData.dateRange.end}</span>
              </div>
              <Button variant="outline" size="sm" onClick={generateSummary} className="gap-2">
                <RefreshCw className="h-4 w-4" />Regenerate
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summaryData.statistics.totalIssues}</div><p className="text-sm text-muted-foreground">Total Issues</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{summaryData.statistics.absent}</div><p className="text-sm text-muted-foreground">Absences</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-amber-600">{summaryData.statistics.late}</div><p className="text-sm text-muted-foreground">Late</p></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{summaryData.statistics.excused}</div><p className="text-sm text-muted-foreground">Excused</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI-Generated Summary</CardTitle>
                <CardDescription>Analysis and recommendations based on academic attendance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {summaryData.summary.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
                    if (line.startsWith("- ")) return <li key={i} className="ml-4">{line.slice(2)}</li>;
                    if (line.trim() === "") return <br key={i} />;
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {summaryData.repeatOffenders.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Students Needing Attention</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryData.repeatOffenders.map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{s.name}</span>
                          <Badge variant="secondary">{s.count} issues</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {summaryData.problematicSubjects.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Subjects with Most Issues</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryData.problematicSubjects.map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{s.name}</span>
                          <Badge variant="secondary">{s.count} issues</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
      <FloatingChatButton />
    </AdminLayout>
  );
};

export default AcademicWeeklySummary;
