import { create } from 'zustand'

/**
 * Ephemeral cache for passing the recording result from the recording page
 * back to the upload page.
 *
 * `Taro.navigateBack` has no native return-value channel, so the recording
 * page writes its result here before navigating back; the upload page reads
 * (and clears) it when it regains focus. Kept out of the persisted auth store
 * on purpose — this is short-lived scratch state.
 */
export interface RecordingResult {
  path: string
  duration: number
}

interface UploadCacheState {
  recordingResult: RecordingResult | null
  setRecordingResult: (r: RecordingResult | null) => void
}

export const useUploadCache = create<UploadCacheState>((set) => ({
  recordingResult: null,
  setRecordingResult: (r) => set({ recordingResult: r })
}))
