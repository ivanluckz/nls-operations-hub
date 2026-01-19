import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Star, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  title: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
}

interface Allocation {
  activity_id: string;
  day_of_week: string;
  slot_number: number;
  preference_rank: number;
  activities: Activity;
}

interface TimetableCardProps {
  allocations: Allocation[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const dayColors: Record<string, string> = {
  Monday: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  Tuesday: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  Wednesday: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  Thursday: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  Friday: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
};

const TimetableCard = ({ allocations }: TimetableCardProps) => {
  const getAllocationByDayAndSlot = (day: string, slot: number) => {
    return allocations.find(a => a.day_of_week === day && a.slot_number === slot);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><Star className="w-3 h-3" />1st</Badge>;
    if (rank === 2) return <Badge variant="secondary">2nd</Badge>;
    if (rank === 3) return <Badge variant="outline">3rd</Badge>;
    return <Badge variant="outline">{rank}th</Badge>;
  };

  return (
    <Card className="shadow-lg border-success/20 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-success/10 to-transparent border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-success" />
          </div>
          <div>
            <span className="text-success">Weekly Timetable</span>
            <p className="text-sm font-normal text-muted-foreground mt-0.5">
              Your assigned co-curricular activities
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3">
          {DAYS.map(day => {
            const slots = day === 'Wednesday' ? [1, 2] : [1];
            
            return slots.map(slot => {
              const allocation = getAllocationByDayAndSlot(day, slot);
              const dayLabel = day === 'Wednesday' ? `${day} · Slot ${slot}` : day;
              
              return (
                <div 
                  key={`${day}-${slot}`}
                  className={cn(
                    "relative rounded-xl p-4 border bg-gradient-to-br transition-all hover:shadow-md",
                    allocation ? dayColors[day] : "border-dashed border-muted-foreground/20 bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {dayLabel}
                        </span>
                        {allocation && getRankBadge(allocation.preference_rank)}
                      </div>
                      
                      {allocation ? (
                        <div>
                          <h4 className="font-semibold text-base truncate">
                            {allocation.activities.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {allocation.activities.teacher_in_charge}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {allocation.activities.schedule}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No activity assigned
                        </p>
                      )}
                    </div>
                    
                    {allocation && (
                      <Badge variant="outline" className="flex-shrink-0 mt-1">
                        {allocation.activities.category}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimetableCard;
