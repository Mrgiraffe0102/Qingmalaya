/** Prefix a stored relative upload path with /static/ for URL use. */
export function coverUrl(path: string | null | undefined): string {
  return path ? `/static/${path}` : '';
}
