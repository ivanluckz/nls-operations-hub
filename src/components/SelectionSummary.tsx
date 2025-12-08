import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2 } from "lucide-react";

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
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday_slot1", label: "Wednesday Slot 1" },
    { key: "wednesday_slot2", label: "Wednesday Slot 2" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
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
  const maxSelections = 30; // 5 choices × 6 day/slots

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Selection Summary
          </span>
          <Badge variant={totalSelections === maxSelections ? "default" : "secondary"}>
            {totalSelections}/{maxSelections}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        {daySlots.map(({ key, label }) => {
          const selections = getSelectionsForDay(key);
          if (selections.length === 0) {
            return (
              <div key={key} className="text-sm">
                <span className="font-medium text-muted-foreground">{label}</span>
                <p className="text-xs text-muted-foreground/60 italic">No selections</p>
              </div>
            );
          }
          return (
            <div key={key}>
              <span className="text-sm font-medium">{label}</span>
              <div className="mt-1 space-y-1">
                {selections.map(({ key: prefKey, activity, rank }) => (
                  <div
                    key={prefKey}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1 text-xs group"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {rank}
                      </Badge>
                      <span className="truncate">{activity.title}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onRemove(prefKey)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SelectionSummary;
