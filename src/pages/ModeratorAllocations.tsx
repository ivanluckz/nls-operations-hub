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

  const handleRunAllocation = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("allocate-activities");
      if (error) throw error;
      
      toast({
        title: "Success!",
        description: `Allocated ${data.allocated} students to activities`,
      });
      
      navigate("/moderator");
    } catch (error: any) {
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
            <p className="text-muted-foreground">
              The AI allocation system will process all submitted preferences and assign students to activities based on their choices and capacity constraints.
            </p>
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
      </main>
    </div>
  );
};

export default ModeratorAllocations;
