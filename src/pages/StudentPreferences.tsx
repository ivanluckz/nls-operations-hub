import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, BookOpen } from "lucide-react";

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
  capacity: number;
  current_enrollment: number;
}

const StudentPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selections, setSelections] = useState<{
    first: string | null;
    second: string | null;
    third: string | null;
  }>({
    first: null,
    second: null,
    third: null,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("is_active", true)
        .order("title");

      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activities",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectActivity = (activityId: string, rank: "first" | "second" | "third") => {
    // Check if activity is already selected in another rank
    const alreadySelected = Object.values(selections).includes(activityId);
    if (alreadySelected) {
      toast({
        variant: "destructive",
        title: "Already Selected",
        description: "This activity is already in your preferences",
      });
      return;
    }

    setSelections(prev => ({ ...prev, [rank]: activityId }));
  };

  const handleRemoveSelection = (rank: "first" | "second" | "third") => {
    setSelections(prev => ({ ...prev, [rank]: null }));
  };

  const handleSubmit = async () => {
    if (!selections.first || !selections.second || !selections.third) {
      toast({
        variant: "destructive",
        title: "Incomplete Selection",
        description: "Please select all three preferences",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("preferences").upsert({
        student_id: user.id,
        first_choice: selections.first,
        second_choice: selections.second,
        third_choice: selections.third,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your preferences have been saved",
      });

      navigate("/student");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save preferences",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityById = (id: string | null) => {
    if (!id) return null;
    return activities.find(a => a.id === id);
  };

  const getRankBadgeColor = (rank: "first" | "second" | "third") => {
    if (rank === "first") return "default";
    if (rank === "second") return "secondary";
    return "outline";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/student")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Select Your Preferences</h1>
          <p className="text-muted-foreground">
            Choose your top 3 co-curricular activities in order of preference
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Current Selections */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-card sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Your Selections</CardTitle>
                <CardDescription>
                  {[selections.first, selections.second, selections.third].filter(Boolean).length}/3 selected
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["first", "second", "third"] as const).map((rank) => {
                  const activity = getActivityById(selections[rank]);
                  return (
                    <div key={rank} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={getRankBadgeColor(rank)}>
                          {rank === "first" ? "1st" : rank === "second" ? "2nd" : "3rd"} Choice
                        </Badge>
                        {activity && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSelection(rank)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      {activity ? (
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">{activity.category}</p>
                        </div>
                      ) : (
                        <div className="p-3 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                          Not selected
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!selections.first || !selections.second || !selections.third || submitting}
                >
                  {submitting ? "Submitting..." : "Submit Preferences"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Available Activities */}
          <div className="lg:col-span-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Available Activities</CardTitle>
                <CardDescription>
                  Click on an activity to select it as your preference
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const isSelected = Object.values(selections).includes(activity.id);
                    const canSelect = !isSelected;
                    const nextRank = !selections.first ? "first" : !selections.second ? "second" : !selections.third ? "third" : null;

                    return (
                      <div
                        key={activity.id}
                        className={`
                          border rounded-lg p-4 transition-all cursor-pointer
                          ${isSelected ? "bg-primary/5 border-primary" : "hover:border-primary/50"}
                          ${!canSelect && !isSelected ? "opacity-50" : ""}
                        `}
                        onClick={() => canSelect && nextRank && handleSelectActivity(activity.id, nextRank)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                              <h3 className="font-semibold">{activity.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {activity.description}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">{activity.category}</Badge>
                              <span className="text-muted-foreground">
                                {activity.schedule}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Teacher: {activity.teacher_in_charge} •{" "}
                              {activity.current_enrollment}/{activity.capacity} enrolled
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentPreferences;
