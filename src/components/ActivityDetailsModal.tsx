import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, User, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ActivityDetailsModalProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ActivityDetailsModal = ({ activity, open, onOpenChange }: ActivityDetailsModalProps) => {
  if (!activity) return null;

  const spotsRemaining = activity.capacity - activity.current_enrollment;
  const enrollmentPercentage = (activity.current_enrollment / activity.capacity) * 100;
  const isAlmostFull = spotsRemaining <= 5;
  const isFull = spotsRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 pb-4">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl mb-2">{activity.title}</DialogTitle>
                <Badge variant="secondary" className="font-normal">
                  {activity.category}
                </Badge>
              </div>
              {!isFull && (
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  isAlmostFull 
                    ? "bg-destructive/10 text-destructive" 
                    : "bg-success/10 text-success"
                )}>
                  <Sparkles className="w-3 h-3" />
                  {spotsRemaining} spots
                </div>
              )}
            </div>
          </DialogHeader>
        </div>
        
        <div className="p-6 pt-2 space-y-5">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {activity.description}
          </p>
          
          {/* Details Grid */}
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teacher</p>
                <p className="text-sm font-medium">{activity.teacher_in_charge}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Schedule</p>
                <p className="text-sm font-medium">{activity.schedule}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shadow-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available Days</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activity.days_of_week?.map((day) => (
                    <Badge key={day} variant="outline" className="text-xs font-normal">
                      {day}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Capacity Section */}
          <div className="p-4 rounded-xl border bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Enrollment</span>
              </div>
              <span className={cn(
                "text-sm font-semibold",
                isFull ? "text-destructive" : isAlmostFull ? "text-amber-500" : "text-foreground"
              )}>
                {activity.current_enrollment} / {activity.capacity}
              </span>
            </div>
            
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  enrollmentPercentage >= 90
                    ? "bg-destructive"
                    : enrollmentPercentage >= 70
                    ? "bg-amber-500"
                    : "bg-primary"
                )}
                style={{ width: `${Math.min(enrollmentPercentage, 100)}%` }}
              />
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              {isFull 
                ? "This activity is currently full" 
                : isAlmostFull 
                ? `Only ${spotsRemaining} spot${spotsRemaining === 1 ? '' : 's'} remaining!` 
                : `${spotsRemaining} spots available`
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityDetailsModal;
