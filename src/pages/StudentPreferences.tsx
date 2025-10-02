import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check } from "lucide-react";

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
  capacity: number;
  current_enrollment: number;
  day_of_week: string;
}

interface DaySelections {
  first: string | null;
  second: string | null;
  third: string | null;
}

interface WeekSelections {
  monday: DaySelections;
  tuesday: DaySelections;
  wednesday: DaySelections;
  thursday: DaySelections;
  friday: DaySelections;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DAY_LABELS: Record<typeof DAYS[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday'
};

const StudentPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selections, setSelections] = useState<WeekSelections>({
    monday: { first: null, second: null, third: null },
    tuesday: { first: null, second: null, third: null },
    wednesday: { first: null, second: null, third: null },
    thursday: { first: null, second: null, third: null },
    friday: { first: null, second: null, third: null },
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
        .order("day_of_week")
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

  const getActivitiesByDay = (day: string) => {
    return activities.filter(a => a.day_of_week === DAY_LABELS[day as keyof typeof DAY_LABELS]);
  };

  const handleSelectActivity = (activityId: string, day: typeof DAYS[number], rank: keyof DaySelections) => {
    const daySelections = selections[day];
    const alreadySelected = Object.values(daySelections).includes(activityId);
    
    if (alreadySelected) {
      toast({
        variant: "destructive",
        title: "Already Selected",
        description: "This activity is already in your preferences for this day",
      });
      return;
    }

    setSelections(prev => ({
      ...prev,
      [day]: { ...prev[day], [rank]: activityId }
    }));
  };

  const handleRemoveSelection = (day: typeof DAYS[number], rank: keyof DaySelections) => {
    setSelections(prev => ({
      ...prev,
      [day]: { ...prev[day], [rank]: null }
    }));
  };

  const handleSubmit = async () => {
    // Check if all days have all 3 preferences selected
    for (const day of DAYS) {
      const daySelections = selections[day];
      if (!daySelections.first || !daySelections.second || !daySelections.third) {
        toast({
          variant: "destructive",
          title: "Incomplete Selection",
          description: `Please select all three preferences for ${DAY_LABELS[day]}`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const preferenceData = {
        student_id: user.id,
        monday_first_choice: selections.monday.first,
        monday_second_choice: selections.monday.second,
        monday_third_choice: selections.monday.third,
        tuesday_first_choice: selections.tuesday.first,
        tuesday_second_choice: selections.tuesday.second,
        tuesday_third_choice: selections.tuesday.third,
        wednesday_first_choice: selections.wednesday.first,
        wednesday_second_choice: selections.wednesday.second,
        wednesday_third_choice: selections.wednesday.third,
        thursday_first_choice: selections.thursday.first,
        thursday_second_choice: selections.thursday.second,
        thursday_third_choice: selections.thursday.third,
        friday_first_choice: selections.friday.first,
        friday_second_choice: selections.friday.second,
        friday_third_choice: selections.friday.third,
      };

      const { error } = await supabase.from("preferences").upsert(preferenceData);

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

  const getRankBadgeColor = (rank: keyof DaySelections) => {
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
      <header className="border-b bg-card shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/student")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit All Preferences"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Select Weekly Preferences</h1>
          <p className="text-muted-foreground">
            Choose your top 3 activities for each day of the week
          </p>
        </div>

        <Tabs defaultValue="monday" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            {DAYS.map(day => (
              <TabsTrigger key={day} value={day}>{DAY_LABELS[day]}</TabsTrigger>
            ))}
          </TabsList>

          {DAYS.map(day => {
            const dayActivities = getActivitiesByDay(day);
            const daySelections = selections[day];
            
            return (
              <TabsContent key={day} value={day} className="space-y-4">
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Current Selections */}
                  <div className="lg:col-span-1">
                    <Card className="shadow-card sticky top-24">
                      <CardHeader>
                        <CardTitle className="text-lg">{DAY_LABELS[day]} Selections</CardTitle>
                        <CardDescription>
                          {[daySelections.first, daySelections.second, daySelections.third].filter(Boolean).length}/3 selected
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(['first', 'second', 'third'] as const).map((rank) => {
                          const activity = getActivityById(daySelections[rank]);
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
                                    onClick={() => handleRemoveSelection(day, rank)}
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
                      </CardContent>
                    </Card>
                  </div>

                  {/* Available Activities */}
                  <div className="lg:col-span-2">
                    <Card className="shadow-card">
                      <CardHeader>
                        <CardTitle>Available for {DAY_LABELS[day]}</CardTitle>
                        <CardDescription>
                          Click on an activity to select it
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {dayActivities.map((activity) => {
                            const isSelected = Object.values(daySelections).includes(activity.id);
                            const canSelect = !isSelected;
                            const nextRank = !daySelections.first ? "first" : !daySelections.second ? "second" : !daySelections.third ? "third" : null;

                            return (
                              <div
                                key={activity.id}
                                className={`
                                  border rounded-lg p-4 transition-all cursor-pointer
                                  ${isSelected ? "bg-primary/5 border-primary" : "hover:border-primary/50"}
                                  ${!canSelect && !isSelected ? "opacity-50" : ""}
                                `}
                                onClick={() => canSelect && nextRank && handleSelectActivity(activity.id, day, nextRank)}
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
                                      <span className="text-muted-foreground">{activity.schedule}</span>
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
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
};

export default StudentPreferences;