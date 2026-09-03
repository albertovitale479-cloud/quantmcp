/// <reference lib="webworker" />

import { parseContinuousFutures } from './parser'

self.onmessage = (event: MessageEvent<{ id: number; text: string }>) => {
  try {
    self.postMessage({ id: event.data.id, parsed: parseContinuousFutures(event.data.text) })
  } catch (error) {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Dataset parsing failed.' })
  }
}

export {}
