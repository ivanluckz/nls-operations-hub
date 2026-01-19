import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  title: string;
  category: string;
}

interface SelectionSummaryProps {
  preferences: Record<string, string>;
  activities: Activity[];
  onRemove: (key: string) => void;
}

const SelectionSummary = ({ preferences, activities, onRemove }: SelectionSummaryProps) => {
  const getActivityById = (id: string) => activities.find(a => a.id === id);

  const daySlots = [
    { key: "monday", label: "Monday", color: "from-blue-500" },
    { key: "tuesday", label: "Tuesday", color: "from-emerald-500" },
    { key: "wednesday_slot1", label: "Wed Slot 1", color: "from-purple-500" },
    { key: "wednesday_slot2", label: "Wed Slot 2", color: "from-purple-400" },
    { key: "thursday", label: "Thursday", color: "from-amber-500" },
    { key: "friday", label: "Friday", color: "from-rose-500" },
  ];

  const choiceLabels = ["first", "second", "third", "fourth", "fifth"];

  const getSelectionsForDay = (dayKey: string) => {
    const selections: { key: string; activity: Activity; rank: number }[] = [];
    choiceLabels.forEach((choice, index) => {
      const prefKey = `${dayKey}_${choice}_choice`;
      const activityId = preferences[prefKey];
      if (activityId) {
        const activity = getActivityById(activityId);
        if (activity) {
          selections.push({ key: prefKey, activity, rank: index + 1 });
        }
      }
    });
    return selections;
  };

  const totalSelections = Object.values(preferences).filter(v => v && v !== "").length;
  const maxSelections = 30;
  const progressPercentage = (totalSelections / maxSelections) * 100;

  return (
    <Card className="sticky top-20 shadow-lg border-0 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ListChecks className="h-4 w-4 text-primary" />
            </div>
            Summary
          </span>
          <Badge 
            variant={totalSelections === maxSelections ? "default" : "secondary"}
            className={cn(
              "px-2.5 py-0.5",
              totalSelections === maxSelections && "bg-success hover:bg-success"
            )}
          >
            {totalSelections}/{maxSelections}
          </Badge>
        </CardTitle>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progressPercentage === 100 ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto p-4">
        {daySlots.map(({ key, label, color }) => {
          const selections = getSelectionsForDay(key);
          const isComplete = selections.length === 5;
          
          return (
            <div 
              key={key}
              className={cn(
                "rounded-lg p-3 transition-colors",
                isComplete ? "bg-success/5 border border-success/20" : "bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full bg-gradient-to-r", color, "to-transparent")} />
                  {label}
                </span>
                {isComplete && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
              </div>
              
              {selections.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No selections yet</p>
              ) : (
                <div className="space-y-1">
                  {selections.map(({ key: prefKey, activity, rank }) => (
                    <div
                      key={prefKey}
                      className="flex items-center justify-between bg-background rounded-md px-2 py-1.5 text-xs group hover:bg-accent/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <Badge 
                          variant={rank === 1 ? "default" : "outline"} 
                          className={cn(
                            "h-5 w-5 p-0 flex items-center justify-center text-[10px] flex-shrink-0",
                            rank === 1 && "bg-amber-500 hover:bg-amber-600"
                          )}
                        >
                          {rank}
                        </Badge>
                        <span className="truncate">{activity.title}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRemove(prefKey)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SelectionSummary;
