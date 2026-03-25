import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatDate(date: string | null): string {
  if (!date) return "";
  return format(parseISO(date), "MMM d, yyyy");
}

export function formatDateShort(date: string | null): string {
  if (!date) return "";
  return format(parseISO(date), "yyyy");
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(parseISO(date), { addSuffix: true });
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function composePartialDate(
  year?: number | null,
  month?: number | null,
  day?: number | null
): string | null {
  if (!year || !month || !day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatPartialDate(
  date: string | null,
  year?: number | null,
  month?: number | null,
  day?: number | null
): string {
  if (year && month && day) {
    return `${MONTH_LABELS[month - 1]} ${day}, ${year}`;
  }
  if (year && month) {
    return `${MONTH_LABELS[month - 1]} ${year}`;
  }
  if (year) {
    return String(year);
  }
  if (month && day) {
    return `${MONTH_LABELS[month - 1]} ${day}`;
  }
  if (month) {
    return MONTH_LABELS[month - 1];
  }
  if (day) {
    return String(day);
  }
  return date ? formatDate(date) : "";
}

export function formatPartialYear(date: string | null, year?: number | null): string {
  if (year) return String(year);
  return date ? formatDateShort(date) : "";
}

export function formatLifespan(
  birth: string | null,
  death: string | null,
  isDeceased: boolean,
  birthYear?: number | null,
  deathYear?: number | null
): string {
  const resolvedBirthYear = formatPartialYear(birth, birthYear) || "?";
  if (isDeceased || death) {
    const resolvedDeathYear = formatPartialYear(death, deathYear) || "?";
    return `${resolvedBirthYear} - ${resolvedDeathYear}`;
  }
  if (resolvedBirthYear !== "?") return `b. ${resolvedBirthYear}`;
  return "";
}
