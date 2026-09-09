import { AppStage } from '../types';

export function resetStageScroll(
  scrollTo: (options: ScrollToOptions) => void,
): void {
  scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

export function shouldShowHomeButton(stage: AppStage): boolean {
  return ![
    AppStage.LANDING,
    AppStage.RESUME_UPLOAD,
    AppStage.FEEDBACK,
    AppStage.SESSION_LOG,
  ].includes(stage);
}
