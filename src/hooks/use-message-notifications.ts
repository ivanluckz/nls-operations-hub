import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const NOTIF_PERM_KEY = "nls-notif-permission-asked";

interface UseMessageNotificationsOptions {
  userId: string;
  /** Channel IDs or activity IDs the user is currently viewing */
  activeChannelId?: string;
}

export function useMessageNotifications({ userId, activeChannelId }: UseMessageNotificationsOptions) {
  const { toast } = useToast();
  const [permissionState, setPermissionState] = useState<NotificationPermission | "prompt">("prompt");
  const [showBanner, setShowBanner] = useState(false);
  const activeChannelRef = useRef(activeChannelId);
  const isVisibleRef = useRef(!document.hidden);

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  // Track tab visibility
  useEffect(() => {
    const handler = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Check current permission state on mount
  useEffect(() => {
    if (!("Notification" in window)) return;
    const current = Notification.permission;
    setPermissionState(current);

    // Show banner if we haven't asked yet and permission is default
    const asked = localStorage.getItem(NOTIF_PERM_KEY);
    if (current === "default" && !asked) {
      setShowBanner(true);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    localStorage.setItem(NOTIF_PERM_KEY, "true");
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      setShowBanner(false);
      if (result === "granted") {
        toast({ title: "🔔 Notifications enabled", description: "You'll be notified of new messages." });
      }
    } catch {
      setShowBanner(false);
    }
  }, [toast]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(NOTIF_PERM_KEY, "true");
    setShowBanner(false);
  }, []);

  const notify = useCallback((title: string, body: string, tag?: string) => {
    // In-app toast (always when visible)
    if (isVisibleRef.current) {
      toast({ title, description: body });
    }

    // Browser notification (when tab not focused and permission granted)
    if (!isVisibleRef.current && Notification.permission === "granted") {
      try {
        const notif = new Notification(title, {
          body,
          icon: "/favicon.png",
          tag: tag || "nls-message",
          silent: false,
        });
        notif.onclick = () => { window.focus(); notif.close(); };
        setTimeout(() => notif.close(), 5000);
      } catch { /* mobile browsers may not support */ }
    }
  }, [toast]);

  return {
    permissionState,
    showBanner,
    requestPermission,
    dismissBanner,
    notify,
  };
}
