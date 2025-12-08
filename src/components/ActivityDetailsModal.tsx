import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, User, Clock } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{activity.title}</DialogTitle>
          <DialogDescription>
            <Badge variant="secondary" className="mt-2">
              {activity.category}
            </Badge>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{activity.description}</p>
          
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Teacher:</span>
              <span>{activity.teacher_in_charge}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Schedule:</span>
              <span>{activity.schedule}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Days:</span>
              <div className="flex flex-wrap gap-1">
                {activity.days_of_week?.map((day) => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Capacity:</span>
              <span className={spotsRemaining <= 5 ? "text-destructive font-medium" : ""}>
                {activity.current_enrollment}/{activity.capacity} enrolled
                ({spotsRemaining} spots left)
              </span>
            </div>
          </div>
          
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all ${
                enrollmentPercentage >= 90
                  ? "bg-destructive"
                  : enrollmentPercentage >= 70
                  ? "bg-yellow-500"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min(enrollmentPercentage, 100)}%` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityDetailsModal;
