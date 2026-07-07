// Gemini Live sessions have a max duration; the server warns via a `goAway`
// message before force-closing (code 1008) if the client doesn't react.
// `sessionResumptionUpdate` periodically hands over a handle that lets a
// fresh connection resume the same session state.
export interface LiveSessionSignal {
  goAway: boolean;
  resumableHandle?: string;
}

export interface LiveSessionMessageShape {
  goAway?: unknown;
  sessionResumptionUpdate?: { resumable?: boolean; newHandle?: string };
}

export function parseLiveSessionSignal(message: LiveSessionMessageShape): LiveSessionSignal {
  const update = message.sessionResumptionUpdate;
  return {
    goAway: !!message.goAway,
    resumableHandle: update?.resumable && update.newHandle ? update.newHandle : undefined,
  };
}
