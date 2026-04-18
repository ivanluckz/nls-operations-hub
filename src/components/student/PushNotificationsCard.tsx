import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const PushNotificationsCard = () => {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) {
    // Hide entirely in preview/iframe to avoid noise
    return null;
  }

  return (
    <Card className="border-2 hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {subscribed ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">DM Push Notifications</p>
            <p className="text-xs text-muted-foreground truncate">
              {subscribed ? "Get notified even when the app is closed" : "Enable to never miss a message"}
            </p>
          </div>
        </div>
        <Switch
          checked={subscribed}
          disabled={loading}
          onCheckedChange={(checked) => (checked ? subscribe() : unsubscribe())}
        />
      </CardContent>
    </Card>
  );
};

export default PushNotificationsCard;
