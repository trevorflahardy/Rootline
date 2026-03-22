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

export function formatLifespan(
  birth: string | null,
  death: string | null,
  isDeceased: boolean
): string {
  const birthYear = birth ? formatDateShort(birth) : "?";
  if (isDeceased || death) {
    const deathYear = death ? formatDateShort(death) : "?";
    return `${birthYear} - ${deathYear}`;
  }
  if (birth) return `b. ${birthYear}`;
  return "";
}
