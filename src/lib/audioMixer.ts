/**
 * Web Audio API Mixing Pipeline
 * 
 * Creates a professional audio mix where microphone is always louder than game audio.
 * 
 * Pipeline:
 *   micSource -> micGain -> micCompressor -> mixBus
 *   gameSource -> gameGain -> mixBus (if available)
 *   mixBus -> masterLimiter -> MediaStreamDestination
 * 
 * The destination stream audio track is attached to the final recording.
 * Always produces exactly 1 audio track, even if only mic is available.
 */

export interface AudioMixSettings {
  /** Microphone gain (default 1.6) */
  micGain: number;
  /** Game/system audio gain (default 0.7) */
  gameGain: number;
  /** Master limiter threshold in dB (default -3) */
  limiterThreshold: number;
  /** Mic compressor threshold in dB (default -24) */
  micCompressorThreshold: number;
  /** Mic compressor ratio (default 4) */
  micCompressorRatio: number;
}

export const DEFAULT_MIX_SETTINGS: AudioMixSettings = {
  micGain: 1.6,
  gameGain: 0.7,
  limiterThreshold: -3,
  micCompressorThreshold: -24,
  micCompressorRatio: 4,
};

export interface AudioMixerConfig {
  /** The AudioContext to use (required) */
  audioContext: AudioContext;
  /** Microphone stream (required for voice capture) */
  microphoneStream: MediaStream | null;
  /** System/game audio stream from getDisplayMedia (optional - may not be available) */
  gameAudioStream: MediaStream | null;
  /** Custom mix settings (uses defaults if not provided) */
  settings?: Partial<AudioMixSettings>;
}

export interface AudioMixerResult {
  /** The mixed audio stream to attach to recordings - always has exactly 1 audio track */
  destinationStream: MediaStream;
  /** Settings that were applied */
  appliedSettings: AudioMixSettings;
  /** Whether game audio was included in the mix */
  hasGameAudio: boolean;
  /** Cleanup function to disconnect all nodes */
  dispose: () => void;
  /** Update mic gain in real-time */
  setMicGain: (value: number) => void;
  /** Update game gain in real-time */
  setGameGain: (value: number) => void;
}

/**
 * Creates a Web Audio mixing pipeline for capture recording.
 * 
 * Mic audio is boosted and compressed for consistent loudness.
 * Game audio is attenuated to sit behind the voice (if available).
 * Master limiter prevents clipping in the final mix.
 * 
 * Always produces exactly 1 audio track, even if only mic is available.
 */
export function createAudioMixer(config: AudioMixerConfig): AudioMixerResult {
  const { audioContext, microphoneStream, gameAudioStream } = config;
  
  // Merge settings with defaults
  const settings: AudioMixSettings = {
    ...DEFAULT_MIX_SETTINGS,
    ...config.settings,
  };
  
  console.log("[AudioMixer] Creating pipeline with settings:", settings);
  
  // Create the destination node (output)
  const destination = audioContext.createMediaStreamDestination();
  
  // Create master limiter (compressor with aggressive settings)
  // This prevents clipping in the final output
  const masterLimiter = audioContext.createDynamicsCompressor();
  masterLimiter.threshold.value = settings.limiterThreshold; // Start limiting at -3dB
  masterLimiter.knee.value = 0; // Hard knee for limiting
  masterLimiter.ratio.value = 20; // High ratio acts as limiter
  masterLimiter.attack.value = 0.001; // Fast attack (1ms)
  masterLimiter.release.value = 0.1; // Quick release (100ms)
  
  // Connect limiter to destination
  masterLimiter.connect(destination);
  console.log("[AudioMixer] Master limiter connected");
  
  // Create mix bus (gain node at unity as a summing point)
  const mixBus = audioContext.createGain();
  mixBus.gain.value = 1.0;
  mixBus.connect(masterLimiter);
  console.log("[AudioMixer] Mix bus connected to limiter");
  
  // Track nodes for cleanup
  const nodes: AudioNode[] = [destination, masterLimiter, mixBus];
  
  // Mic chain: source -> gain -> compressor -> mixBus
  let micGainNode: GainNode | null = null;
  let micCompressor: DynamicsCompressorNode | null = null;
  let micSource: MediaStreamAudioSourceNode | null = null;
  
  if (microphoneStream && microphoneStream.getAudioTracks().length > 0) {
    // Create mic source
    micSource = audioContext.createMediaStreamSource(microphoneStream);
    nodes.push(micSource);
    
    // Mic gain node (boost mic level)
    micGainNode = audioContext.createGain();
    micGainNode.gain.value = settings.micGain;
    nodes.push(micGainNode);
    
    // Mic compressor (keeps voice consistently loud)
    micCompressor = audioContext.createDynamicsCompressor();
    micCompressor.threshold.value = settings.micCompressorThreshold;
    micCompressor.knee.value = 10; // Soft knee for natural sound
    micCompressor.ratio.value = settings.micCompressorRatio;
    micCompressor.attack.value = 0.003; // 3ms attack
    micCompressor.release.value = 0.25; // 250ms release
    nodes.push(micCompressor);
    
    // Connect mic chain
    micSource.connect(micGainNode);
    micGainNode.connect(micCompressor);
    micCompressor.connect(mixBus);
    
    console.log("[AudioMixer] Mic chain connected: source -> gain(%.2f) -> compressor -> mixBus", settings.micGain);
  } else {
    console.log("[AudioMixer] No microphone stream provided");
  }
  
  // Game audio chain: source -> gain -> mixBus (no compression, just level control)
  let gameGainNode: GainNode | null = null;
  let gameSource: MediaStreamAudioSourceNode | null = null;
  let hasGameAudio = false;
  
  if (gameAudioStream && gameAudioStream.getAudioTracks().length > 0) {
    // Create game audio source
    gameSource = audioContext.createMediaStreamSource(gameAudioStream);
    nodes.push(gameSource);
    
    // Game gain node (attenuate to sit behind mic)
    gameGainNode = audioContext.createGain();
    gameGainNode.gain.value = settings.gameGain;
    nodes.push(gameGainNode);
    
    // Connect game chain (simpler, no compression)
    gameSource.connect(gameGainNode);
    gameGainNode.connect(mixBus);
    
    hasGameAudio = true;
    console.log("[AudioMixer] Game chain connected: source -> gain(%.2f) -> mixBus", settings.gameGain);
  } else {
    // No game audio available - this is fine, mic-only recording
    console.log("[AudioMixer] No game audio stream available (mic-only recording)");
  }
  
  // Verify we have exactly 1 audio track in the output
  const outputTracks = destination.stream.getAudioTracks();
  console.log("[AudioMixer] Output stream has %d audio track(s)", outputTracks.length);
  
  // Real-time gain control functions
  const setMicGain = (value: number) => {
    if (micGainNode) {
      micGainNode.gain.setValueAtTime(value, audioContext.currentTime);
      console.log("[AudioMixer] Mic gain updated to:", value);
    }
  };
  
  const setGameGain = (value: number) => {
    if (gameGainNode) {
      gameGainNode.gain.setValueAtTime(value, audioContext.currentTime);
      console.log("[AudioMixer] Game gain updated to:", value);
    }
  };
  
  // Cleanup function
  const dispose = () => {
    console.log("[AudioMixer] Disposing audio pipeline...");
    
    // Disconnect all nodes
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch (e) {
        // Node may already be disconnected
      }
    }
    
    console.log("[AudioMixer] Pipeline disposed");
  };
  
  return {
    destinationStream: destination.stream,
    appliedSettings: settings,
    hasGameAudio,
    dispose,
    setMicGain,
    setGameGain,
  };
}

/**
 * Extracts audio mix settings suitable for storing in session metadata.
 */
export function serializeMixSettings(settings: AudioMixSettings): Record<string, number> {
  return {
    mic_gain: settings.micGain,
    game_gain: settings.gameGain,
    limiter_threshold_db: settings.limiterThreshold,
    mic_compressor_threshold_db: settings.micCompressorThreshold,
    mic_compressor_ratio: settings.micCompressorRatio,
  };
}
