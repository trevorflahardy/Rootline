"use client";

import { useState } from "react";
import { Cake, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BirthdayReminder } from "@/lib/actions/birthday";

interface BirthdayReminderBannerProps {
  reminders: BirthdayReminder[];
}

function formatReminder(reminder: BirthdayReminder): string {
  const { name, daysUntil } = reminder;
  if (daysUntil === 0) return `🎂 ${name} — today!`;
  if (daysUntil === 1) return `${name} — tomorrow`;
  return `${name} — in ${daysUntil} days`;
}

export function BirthdayReminderBanner({ reminders }: BirthdayReminderBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || reminders.length === 0) return null;

  const summary = reminders.map(formatReminder).join(" · ");

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20 backdrop-blur-sm">
      <Cake className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">Upcoming birthdays</p>
        <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
