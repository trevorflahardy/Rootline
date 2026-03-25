"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/utils/date";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/lib/actions/notification";

function PersonPill({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full glass-card glass-light px-2.5 py-1 text-[11px] font-medium">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={16}
          height={16}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center text-[9px] text-primary">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate max-w-[120px]">{name}</span>
    </span>
  );
}

function notificationVerb(type: string): string {
  if (type === "member_added") return "was added";
  if (type === "member_updated") return "was updated";
  if (type === "member_removed") return "was removed";
  if (type === "relationship_added") return "relationship added";
  if (type === "relationship_removed") return "relationship removed";
  return "changed";
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      try {
        const data = await getNotifications(20);
        setNotifications(data);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleMarkRead(id: string) {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function handleClickNotification(notification: Notification) {
    if (!notification.is_read) handleMarkRead(notification.id);
    if (notification.tree_id) {
      router.push(`/tree/${notification.tree_id}`);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 glass-card glass-elevated glass-edge-top border-white/10" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-0 ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    {n.subject_members.length > 0 || n.actor ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {n.subject_members.map((member) => (
                            <PersonPill key={member.id} name={member.name} avatarUrl={member.avatar_url} />
                          ))}
                          <span className="text-xs text-muted-foreground">{notificationVerb(n.type)}</span>
                        </div>

                        {n.actor && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">by</span>
                            <PersonPill name={n.actor.display_name} avatarUrl={n.actor.avatar_url} />
                          </div>
                        )}

                        {n.relationship_type && (
                          <p className="text-[11px] text-muted-foreground capitalize">
                            Type: {n.relationship_type.replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm leading-snug">{n.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
