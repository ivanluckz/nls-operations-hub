import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Info, Users } from "lucide-react";
import { PreferencesSchema } from "@/lib/validation";
import ActivityDetailsModal from "@/components/ActivityDetailsModal";
import SelectionSummary from "@/components/SelectionSummary";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
  capacity: number;
  current_enrollment: number;
  days_of_week: string[];
}

const StudentPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [preferences, setPreferences] = useState({
    monday_first_choice: "",
    monday_second_choice: "",
    monday_third_choice: "",
    monday_fourth_choice: "",
    monday_fifth_choice: "",
    tuesday_first_choice: "",
    tuesday_second_choice: "",
    tuesday_third_choice: "",
    tuesday_fourth_choice: "",
    tuesday_fifth_choice: "",
    wednesday_slot1_first_choice: "",
    wednesday_slot1_second_choice: "",
    wednesday_slot1_third_choice: "",
    wednesday_slot1_fourth_choice: "",
    wednesday_slot1_fifth_choice: "",
    wednesday_slot2_first_choice: "",
    wednesday_slot2_second_choice: "",
    wednesday_slot2_third_choice: "",
    wednesday_slot2_fourth_choice: "",
    wednesday_slot2_fifth_choice: "",
    thursday_first_choice: "",
    thursday_second_choice: "",
    thursday_third_choice: "",
    thursday_fourth_choice: "",
    thursday_fifth_choice: "",
    friday_first_choice: "",
    friday_second_choice: "",
    friday_third_choice: "",
    friday_fourth_choice: "",
    friday_fifth_choice: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(activities.map(a => a.category));
    return Array.from(cats).sort();
  }, [activities]);

  useEffect(() => {
    fetchActivities();
    fetchExistingPreferences();
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

  const fetchExistingPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("preferences")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      if (data) {
        setPreferences({
          monday_first_choice: data.monday_first_choice || "",
          monday_second_choice: data.monday_second_choice || "",
          monday_third_choice: data.monday_third_choice || "",
          monday_fourth_choice: data.monday_fourth_choice || "",
          monday_fifth_choice: data.monday_fifth_choice || "",
          tuesday_first_choice: data.tuesday_first_choice || "",
          tuesday_second_choice: data.tuesday_second_choice || "",
          tuesday_third_choice: data.tuesday_third_choice || "",
          tuesday_fourth_choice: data.tuesday_fourth_choice || "",
          tuesday_fifth_choice: data.tuesday_fifth_choice || "",
          wednesday_slot1_first_choice: data.wednesday_slot1_first_choice || "",
          wednesday_slot1_second_choice: data.wednesday_slot1_second_choice || "",
          wednesday_slot1_third_choice: data.wednesday_slot1_third_choice || "",
          wednesday_slot1_fourth_choice: data.wednesday_slot1_fourth_choice || "",
          wednesday_slot1_fifth_choice: data.wednesday_slot1_fifth_choice || "",
          wednesday_slot2_first_choice: data.wednesday_slot2_first_choice || "",
          wednesday_slot2_second_choice: data.wednesday_slot2_second_choice || "",
          wednesday_slot2_third_choice: data.wednesday_slot2_third_choice || "",
          wednesday_slot2_fourth_choice: data.wednesday_slot2_fourth_choice || "",
          wednesday_slot2_fifth_choice: data.wednesday_slot2_fifth_choice || "",
          thursday_first_choice: data.thursday_first_choice || "",
          thursday_second_choice: data.thursday_second_choice || "",
          thursday_third_choice: data.thursday_third_choice || "",
          thursday_fourth_choice: data.thursday_fourth_choice || "",
          thursday_fifth_choice: data.thursday_fifth_choice || "",
          friday_first_choice: data.friday_first_choice || "",
          friday_second_choice: data.friday_second_choice || "",
          friday_third_choice: data.friday_third_choice || "",
          friday_fourth_choice: data.friday_fourth_choice || "",
          friday_fifth_choice: data.friday_fifth_choice || "",
        });
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    }
  };

  const getActivitiesByDay = (day: string) => {
    let filtered = activities.filter(a => a.days_of_week && a.days_of_week.includes(day));
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(query) ||
        a.teacher_in_charge.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(a => a.category === categoryFilter);
    }
    
    return filtered;
  };

  const handlePreferenceChange = (day: string, choice: string, value: string) => {
    const selectedActivity = activities.find(a => a.id === value);
    
    if (selectedActivity && selectedActivity.days_of_week) {
      const choiceRank = choice;
      const updates: Record<string, string> = {};
      
      if (day.includes('slot')) {
        updates[`${day}_${choice}`] = value;
      } else {
        selectedActivity.days_of_week.forEach(availableDay => {
          const dayLower = availableDay.toLowerCase();
          
          if (availableDay === 'Wednesday') {
            updates[`${dayLower}_slot1_${choiceRank}`] = value;
            updates[`${dayLower}_slot2_${choiceRank}`] = value;
          } else {
            updates[`${dayLower}_${choiceRank}`] = value;
          }
        });
      }
      
      setPreferences(prev => ({
        ...prev,
        ...updates
      }));
      
      if (Object.keys(updates).length > 1) {
        const dayNames = selectedActivity.days_of_week.join(', ');
        toast({
          title: "Days Synced",
          description: `This activity is available on ${dayNames}. Selection applied to all days.`,
        });
      }
    } else {
      setPreferences(prev => ({
        ...prev,
        [`${day}_${choice}`]: value
      }));
    }
  };

  const handleRemoveSelection = (key: string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: ""
    }));
  };

  const handleSaveDay = async (day: string, slot?: number) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const dayLower = day.toLowerCase();
      const slotSuffix = slot ? `_slot${slot}` : '';
      
      const { data: existingData } = await supabase
        .from("preferences")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      const updateData: any = {
        student_id: user.id,
        ...(existingData || {}),
      };

      const choices = ['first_choice', 'second_choice', 'third_choice', 'fourth_choice', 'fifth_choice'];
      choices.forEach(choice => {
        const key = `${dayLower}${slotSuffix}_${choice}`;
        updateData[key] = preferences[key as keyof typeof preferences] || null;
      });

      const { error } = await supabase.from("preferences").upsert([updateData]);

      if (error) throw error;

      toast({
        title: "Saved!",
        description: `${day}${slot ? ` Slot ${slot}` : ''} preferences have been updated`,
      });
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const preferencesData: any = {
        student_id: user.id,
      };
      
      Object.entries(preferences).forEach(([key, value]) => {
        preferencesData[key] = value === "" ? null : value;
      });

      const validation = PreferencesSchema.safeParse(preferencesData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: `${firstError.path.join('.')}: ${firstError.message}`,
        });
        return;
      }

      const { error } = await supabase.from("preferences").upsert([{
        student_id: validation.data.student_id!,
        monday_first_choice: validation.data.monday_first_choice ?? null,
        monday_second_choice: validation.data.monday_second_choice ?? null,
        monday_third_choice: validation.data.monday_third_choice ?? null,
        monday_fourth_choice: validation.data.monday_fourth_choice ?? null,
        monday_fifth_choice: validation.data.monday_fifth_choice ?? null,
        tuesday_first_choice: validation.data.tuesday_first_choice ?? null,
        tuesday_second_choice: validation.data.tuesday_second_choice ?? null,
        tuesday_third_choice: validation.data.tuesday_third_choice ?? null,
        tuesday_fourth_choice: validation.data.tuesday_fourth_choice ?? null,
        tuesday_fifth_choice: validation.data.tuesday_fifth_choice ?? null,
        wednesday_slot1_first_choice: validation.data.wednesday_slot1_first_choice ?? null,
        wednesday_slot1_second_choice: validation.data.wednesday_slot1_second_choice ?? null,
        wednesday_slot1_third_choice: validation.data.wednesday_slot1_third_choice ?? null,
        wednesday_slot1_fourth_choice: validation.data.wednesday_slot1_fourth_choice ?? null,
        wednesday_slot1_fifth_choice: validation.data.wednesday_slot1_fifth_choice ?? null,
        wednesday_slot2_first_choice: validation.data.wednesday_slot2_first_choice ?? null,
        wednesday_slot2_second_choice: validation.data.wednesday_slot2_second_choice ?? null,
        wednesday_slot2_third_choice: validation.data.wednesday_slot2_third_choice ?? null,
        wednesday_slot2_fourth_choice: validation.data.wednesday_slot2_fourth_choice ?? null,
        wednesday_slot2_fifth_choice: validation.data.wednesday_slot2_fifth_choice ?? null,
        thursday_first_choice: validation.data.thursday_first_choice ?? null,
        thursday_second_choice: validation.data.thursday_second_choice ?? null,
        thursday_third_choice: validation.data.thursday_third_choice ?? null,
        thursday_fourth_choice: validation.data.thursday_fourth_choice ?? null,
        thursday_fifth_choice: validation.data.thursday_fifth_choice ?? null,
        friday_first_choice: validation.data.friday_first_choice ?? null,
        friday_second_choice: validation.data.friday_second_choice ?? null,
        friday_third_choice: validation.data.friday_third_choice ?? null,
        friday_fourth_choice: validation.data.friday_fourth_choice ?? null,
        friday_fifth_choice: validation.data.friday_fifth_choice ?? null,
      }]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "All preferences have been saved",
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

  const getAllSelectedActivityIds = (): Set<string> => {
    const selected = new Set<string>();
    Object.values(preferences).forEach(value => {
      if (value && value !== "") {
        selected.add(value);
      }
    });
    return selected;
  };

  const canSelectMultipleTimes = (activity: Activity): boolean => {
    const daysCount = activity.days_of_week?.length || 0;
    if (daysCount >= 3) return true;
    
    const days = activity.days_of_week || [];
    const hasWedSlot1 = days.includes('Wednesday Slot 1');
    const hasWedSlot2 = days.includes('Wednesday Slot 2');
    if (hasWedSlot1 && hasWedSlot2) return true;
    
    return false;
  };

  const handleViewDetails = (activity: Activity) => {
    setSelectedActivity(activity);
    setModalOpen(true);
  };

  const renderDayPreferences = (day: string, slot?: number) => {
    const dayLower = day.toLowerCase();
    const slotSuffix = slot ? `_slot${slot}` : '';
    const dayActivities = getActivitiesByDay(day);
    const cardTitle = slot ? `${day} - Slot ${slot}` : day;
    const allSelected = getAllSelectedActivityIds();

    return (
      <Card key={`${day}${slotSuffix}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{cardTitle}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveDay(day, slot)}
            disabled={submitting}
          >
            Save {day}{slot ? ` Slot ${slot}` : ''}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((choice) => {
            const choiceLabel = ['first', 'second', 'third', 'fourth', 'fifth'][choice - 1];
            const choiceName = `${choiceLabel.charAt(0).toUpperCase()}${choiceLabel.slice(1)} Choice`;
            const currentValue = preferences[`${dayLower}${slotSuffix}_${choiceLabel}_choice` as keyof typeof preferences];
            const currentActivity = activities.find(a => a.id === currentValue);
            
            return (
              <div key={choice}>
                <label className="text-sm font-medium mb-2 block">{choiceName}</label>
                <div className="flex gap-2">
                  <Select
                    value={currentValue}
                    onValueChange={(value) =>
                      handlePreferenceChange(`${dayLower}${slotSuffix}`, `${choiceLabel}_choice`, value)
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={`Select ${choiceName.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {dayActivities.map((activity) => {
                        const isAlreadySelected = allSelected.has(activity.id) && activity.id !== currentValue;
                        const allowMultiple = canSelectMultipleTimes(activity);
                        const shouldDisable = isAlreadySelected && !allowMultiple;
                        const spotsLeft = activity.capacity - activity.current_enrollment;
                        
                        return (
                          <SelectItem 
                            key={activity.id} 
                            value={activity.id}
                            disabled={shouldDisable}
                            className={shouldDisable ? "opacity-50" : ""}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">
                                {activity.title}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px] px-1">
                                  {activity.category}
                                </Badge>
                                <span className={`flex items-center gap-1 ${spotsLeft <= 5 ? "text-destructive" : ""}`}>
                                  <Users className="h-3 w-3" />
                                  {spotsLeft}
                                </span>
                              </div>
                            </div>
                            {shouldDisable && <span className="text-destructive ml-2">- Already selected</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {currentActivity && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(currentActivity)}
                      title="View activity details"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
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
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/student")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Preferences"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Activity Preferences</h1>
          <CardDescription>
            Select your top 5 activity preferences for each day/slot. You can save individual days or submit all at once.
          </CardDescription>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities by name, teacher, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {renderDayPreferences("Monday")}
            {renderDayPreferences("Tuesday")}
            {renderDayPreferences("Wednesday", 1)}
            {renderDayPreferences("Wednesday", 2)}
            {renderDayPreferences("Thursday")}
            {renderDayPreferences("Friday")}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting} size="lg">
                {submitting ? "Submitting..." : "Submit All Preferences"}
              </Button>
            </div>
          </div>

          {/* Selection Summary Sidebar */}
          <div className="hidden lg:block">
            <SelectionSummary
              preferences={preferences}
              activities={activities}
              onRemove={handleRemoveSelection}
            />
          </div>
        </div>
      </main>

      <ActivityDetailsModal
        activity={selectedActivity}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default StudentPreferences;
