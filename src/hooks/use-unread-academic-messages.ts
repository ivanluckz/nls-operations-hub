import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "academic_chat_last_seen";

function getLastSeen(groupId: string): string {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data[groupId] || "1970-01-01T00:00:00Z";
  } catch {
    return "1970-01-01T00:00:00Z";
  }
}

function setLastSeen(groupId: string) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    data[groupId] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function useUnreadAcademicMessages(
  classGroupIds: string[],
  userId: string
) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!classGroupIds.length || !userId) return;

    const counts: Record<string, number> = {};
    for (const gid of classGroupIds) {
      const lastSeen = getLastSeen(gid);
      const { count } = await (supabase as any)
        .from("academic_messages")
        .select("*", { count: "exact", head: true })
        .eq("class_group_id", gid)
        .neq("sender_id", userId)
        .gt("created_at", lastSeen);
      counts[gid] = count || 0;
    }
    setUnreadCounts(counts);
  }, [classGroupIds.join(","), userId]);

  useEffect(() => {
    fetchCounts();

    // Listen for new messages across all groups
    const channels = classGroupIds.map((gid) =>
      supabase
        .channel(`unread-academic-${gid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "academic_messages",
            filter: `class_group_id=eq.${gid}`,
          },
          (payload) => {
            const msg = payload.new as { sender_id: string };
            if (msg.sender_id !== userId) {
              setUnreadCounts((prev) => ({
                ...prev,
                [gid]: (prev[gid] || 0) + 1,
              }));
            }
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [fetchCounts]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const markGroupAsRead = useCallback((groupId: string) => {
    setLastSeen(groupId);
    setUnreadCounts((prev) => ({ ...prev, [groupId]: 0 }));
  }, []);

  const markAllAsRead = useCallback(() => {
    for (const gid of classGroupIds) {
      setLastSeen(gid);
    }
    setUnreadCounts({});
  }, [classGroupIds]);

  return { unreadCounts, totalUnread, markGroupAsRead, markAllAsRead };
}
