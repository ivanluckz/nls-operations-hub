import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Unlink, CheckCircle2 } from "lucide-react";

const CalendarSyncCard = () => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    checkConnection();

    // Handle callback redirect
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get("calendar");
    if (calendarStatus === "connected") {
      setIsConnected(true);
      toast({ title: "Google Calendar Connected!", description: "You can now sync your activities." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (calendarStatus === "error") {
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not connect Google Calendar. Please try again." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error("Error checking calendar connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=auth-url&redirect_uri=${encodeURIComponent(window.location.origin + "/student")}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error getting auth URL:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not start Google Calendar connection." });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=sync`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.error === "token_expired" || data.error === "not_connected") {
        setIsConnected(false);
        toast({ variant: "destructive", title: "Reconnect Required", description: "Please reconnect your Google Calendar." });
        return;
      }

      toast({
        title: "Calendar Synced!",
        description: data.message,
      });
    } catch (error) {
      console.error("Error syncing calendar:", error);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not sync activities to calendar." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=disconnect`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setIsConnected(false);
      toast({ title: "Disconnected", description: "Google Calendar has been disconnected." });
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  };

  if (isLoading) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Google Calendar</CardTitle>
        </div>
        <CardDescription>
          {isConnected
            ? "Your calendar is connected. Sync your activities anytime."
            : "Connect your Google Calendar to sync your activity schedule."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {isConnected ? (
          <>
            <Button onClick={handleSync} disabled={isSyncing} size="sm">
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Connect Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CalendarSyncCard;
