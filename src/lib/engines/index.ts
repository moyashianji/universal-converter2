// Engines index - Export all conversion engines

export { BaseEngine } from './base-engine';
export { ImageEngine, imageEngine } from './image-engine';
export { VideoEngine, videoEngine } from './video-engine';
export { AudioEngine, audioEngine } from './audio-engine';
export { DocumentEngine, documentEngine } from './document-engine';

// Register all engines with orchestrator
import { orchestrator } from '../core/orchestrator';
import { imageEngine } from './image-engine';
import { videoEngine } from './video-engine';
import { audioEngine } from './audio-engine';
import { documentEngine } from './document-engine';

export function registerAllEngines(): void {
  orchestrator.registerEngine(imageEngine);
  orchestrator.registerEngine(videoEngine);
  orchestrator.registerEngine(audioEngine);
  orchestrator.registerEngine(documentEngine);
}

// Auto-register engines
registerAllEngines();
