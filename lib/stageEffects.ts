export function resetStageScroll(
  scrollTo: (options: ScrollToOptions) => void,
): void {
  scrollTo({ top: 0, left: 0, behavior: 'auto' });
}
