import type { PracticeSetup } from '../types';

interface DisplayMediaCapability {
  getDisplayMedia?: unknown;
}

export function canShareScreen(
  setup: PracticeSetup,
  mediaDevices?: DisplayMediaCapability,
): boolean {
  return setup.kind === 'rehearsal'
    && setup.supportsScreenShare
    && typeof mediaDevices?.getDisplayMedia === 'function';
}

export function stripDataUrlPrefix(value: string): string {
  const comma = value.indexOf(',');
  return value.startsWith('data:') && comma >= 0 ? value.slice(comma + 1) : value;
}

export function captureScreenFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): string | null {
  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return stripDataUrlPrefix(canvas.toDataURL('image/jpeg', 0.72));
}
