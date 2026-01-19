import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertCircle, LucideIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusType = "allocated" | "submitted" | "pending";

interface StatusCardProps {
  status: StatusType;
  onAction?: () => void;
}

const statusConfig: Record<StatusType, {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
  buttonText?: string;
}> = {
  allocated: {
    icon: CheckCircle2,
    title: "You're All Set!",
    description: "Your activities have been allocated. Check your weekly timetable below.",
    gradient: "from-success/20 via-success/10 to-transparent",
    iconColor: "text-success",
  },
  submitted: {
    icon: Clock,
    title: "Preferences Received",
    description: "Your choices are being reviewed. Allocations will be processed soon.",
    gradient: "from-secondary/20 via-secondary/10 to-transparent",
    iconColor: "text-secondary",
    buttonText: "Edit Preferences",
  },
  pending: {
    icon: AlertCircle,
    title: "Choose Your Activities",
    description: "Select your preferred co-curricular activities for each day.",
    gradient: "from-accent/20 via-accent/10 to-transparent",
    iconColor: "text-accent",
    buttonText: "Get Started",
  },
};

const StatusCard = ({ status, onAction }: StatusCardProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg">
      {/* Background gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", config.gradient)} />
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative p-6 flex items-start gap-4">
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
          "bg-background/80 backdrop-blur-sm shadow-sm"
        )}>
          <Icon className={cn("w-6 h-6", config.iconColor)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">{config.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          
          {config.buttonText && onAction && (
            <Button 
              onClick={onAction}
              className="mt-4 gap-2 group"
              size="sm"
            >
              {config.buttonText}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default StatusCard;
