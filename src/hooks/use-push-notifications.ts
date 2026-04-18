import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const VAPID_PUBLIC_KEY =
  "BNEg6n8GpQF-98N852boa6OINvIQvxn5cjtRaWQYbwIGHlfVrbaMpHmBzbBcGqxD76pXBTVU6JQRVqZLkI_7yGk";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !isInIframe() &&
    !isPreviewHost()
  );
}

export function usePushNotifications() {
  const { toast } = useToast();
  const [supported] = useState<boolean>(() => isPushSupported());
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Check current subscription state
  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch { /* ignore */ }
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      toast({
        title: "Push not available here",
        description: "Push notifications only work on the published app, not the editor preview.",
      });
      return false;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ variant: "destructive", title: "Permission denied", description: "Enable notifications in browser settings." });
        return false;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;

      setSubscribed(true);
      toast({ title: "🔔 Push enabled", description: "You'll get notified of new direct messages." });
      return true;
    } catch (e: any) {
      console.error("push subscribe failed", e);
      toast({ variant: "destructive", title: "Couldn't enable push", description: e.message ?? "Unknown error" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, toast]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast({ title: "Push disabled" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't disable push", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [supported, toast]);

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
