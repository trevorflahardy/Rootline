export function getPhotoUrl(storagePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${baseUrl}/storage/v1/object/public/tree-photos/${storagePath}`;
}
