export type TimelineEventType = 'birth' | 'death' | 'marriage' | 'divorce';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;        // ISO date string (YYYY-MM-DD or YYYY)
  year: number;
  decade: number;      // year rounded down to nearest 10 (e.g. 1980 for 1984)
  memberId: string;
  memberName: string;
  place: string | null;
  relatedMemberId?: string;   // for marriage/divorce: the other person
  relatedMemberName?: string;
}
