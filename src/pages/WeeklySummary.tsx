import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Calendar, Users, Activity, RefreshCw } from "lucide-react";

interface SummaryData {
  summary: string;
  statistics: {
    totalIssues: number;
    absent: number;
    late: number;
    excused: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  repeatOffenders: Array<{ name: string; count: number }>;
  problematicActivities: Array<{ name: string; count: number }>;
}

const WeeklySummary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-weekly-summary");

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSummaryData(data);
      toast({
        title: "Summary Generated",
        description: "Weekly attendance summary has been generated successfully.",
      });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Weekly Summary</h1>
            <p className="text-muted-foreground">
              Generate AI-powered attendance trend reports
            </p>
          </div>
        </div>

        {!summaryData && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Generate Weekly Summary</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Use AI to analyze the past week's attendance data and generate insights,
                identify patterns, and get recommendations.
              </p>
              <Button onClick={generateSummary} size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Summary
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {summaryData && !loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{summaryData.dateRange.start} - {summaryData.dateRange.end}</span>
              </div>
              <Button variant="outline" size="sm" onClick={generateSummary} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{summaryData.statistics.totalIssues}</div>
                  <p className="text-sm text-muted-foreground">Total Issues</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-destructive">{summaryData.statistics.absent}</div>
                  <p className="text-sm text-muted-foreground">Absences</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">{summaryData.statistics.late}</div>
                  <p className="text-sm text-muted-foreground">Late Arrivals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">{summaryData.statistics.excused}</div>
                  <p className="text-sm text-muted-foreground">Excused</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Generated Summary
                </CardTitle>
                <CardDescription>
                  Analysis and recommendations based on attendance data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {summaryData.summary.split("\n").map((line, index) => {
                    if (line.startsWith("# ")) {
                      return <h1 key={index} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
                    }
                    if (line.startsWith("## ")) {
                      return <h2 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
                    }
                    if (line.startsWith("### ")) {
                      return <h3 key={index} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
                    }
                    if (line.startsWith("- ")) {
                      return <li key={index} className="ml-4">{line.slice(2)}</li>;
                    }
                    if (line.startsWith("**") && line.endsWith("**")) {
                      return <p key={index} className="font-semibold">{line.slice(2, -2)}</p>;
                    }
                    if (line.trim() === "") {
                      return <br key={index} />;
                    }
                    return <p key={index} className="mb-2">{line}</p>;
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {summaryData.repeatOffenders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Students Needing Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryData.repeatOffenders.map((student, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{student.name}</span>
                          <Badge variant="secondary">{student.count} issues</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {summaryData.problematicActivities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4" />
                      Activities with Most Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summaryData.problematicActivities.map((activity, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{activity.name}</span>
                          <Badge variant="secondary">{activity.count} issues</Badge>
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
    </div>
  );
};

export default WeeklySummary;
