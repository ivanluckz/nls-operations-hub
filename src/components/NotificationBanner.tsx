import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationBannerProps {
  onEnable: () => void;
  onDismiss: () => void;
}

const NotificationBanner = ({ onEnable, onDismiss }: NotificationBannerProps) => (
  <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20 animate-fade-in">
    <Bell className="h-4 w-4 text-primary shrink-0" />
    <p className="text-xs text-foreground flex-1">
      Enable notifications to get alerted when new messages arrive.
    </p>
    <Button size="sm" variant="default" className="text-xs h-7 px-3" onClick={onEnable}>
      Enable
    </Button>
    <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
);

export default NotificationBanner;
