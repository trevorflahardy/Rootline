import { Badge } from "@/components/ui/badge";
import type { DocumentType } from "@/types/document";

const colorMap: Record<DocumentType, string> = {
  birth_certificate: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  marriage_license: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  death_certificate: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  immigration: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  legal: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  medical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  photo_album: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

const labelMap: Record<DocumentType, string> = {
  birth_certificate: "Birth Certificate",
  marriage_license: "Marriage License",
  death_certificate: "Death Certificate",
  immigration: "Immigration",
  legal: "Legal",
  medical: "Medical",
  photo_album: "Photo Album",
  other: "Other",
};

interface DocumentTypeBadgeProps {
  documentType: DocumentType;
}

export function DocumentTypeBadge({ documentType }: DocumentTypeBadgeProps) {
  return (
    <Badge variant="secondary" className={colorMap[documentType]}>
      {labelMap[documentType]}
    </Badge>
  );
}
