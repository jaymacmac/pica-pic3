import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageItem } from '../types';
import { analyzeImage, urlToBase64, generateSpeech } from '../services/geminiService';
import { 
  XMarkIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  SparklesIcon, 
  InformationCircleIcon,
  SpeakerWaveIcon,
  TrashIcon,
  PaintBrushIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline';

interface ImageViewerProps {
  image: ImageItem;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  onDelete: () => void;
  onGenerate: (prompt: string) => void;
  onVisualize: (image: ImageItem) => void;
}

// Audio helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
  image, 
  isOpen, 
  onClose, 
  onNext, 
  onPrev,
  hasNext,
  hasPrev,
  onDelete,
  onGenerate,
  onVisualize
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(image.description || null);
  const [showInfo, setShowInfo] = useState(false);
  
  // Audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Reset local state when image changes
  useEffect(() => {
    setAnalysis(image.description || null);
    setShowInfo(false);
    stopAudio();
  }, [image]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && hasNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    if (e.key === 'Delete') onDelete();
  }, [isOpen, onClose, onNext, onPrev, hasNext, hasPrev, onDelete]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Clean up audio on unmount/close
  useEffect(() => {
    return () => stopAudio();
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handleAnalyze = async () => {
    if (analysis) {
      setShowInfo(true);
      return;
    }

    setIsAnalyzing(true);
    setShowInfo(true); // Open panel to show loading
    try {
      let base64 = image.base64Data;
      if (!base64) {
        base64 = await urlToBase64(image.url);
      }
      const result = await analyzeImage(base64);
      setAnalysis(result);
    } catch (error) {
      setAnalysis("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking) {
      stopAudio();
      return;
    }
    
    if (!analysis) return;

    setIsSpeaking(true);

    try {
      // 1. Get Base64 Audio
      const base64Audio = await generateSpeech(analysis);
      
      // 2. Setup Audio Context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = ctx;

      // 3. Decode
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, ctx);

      // 4. Play
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsSpeaking(false);
        audioContextRef.current = null;
      };
      source.start(0);
      audioSourceRef.current = source;

    } catch (error) {
      console.error("Audio playback error", error);
      setIsSpeaking(false);
      stopAudio();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity duration-300 animate-fade-in">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/60 to-transparent">
        <h2 className="text-white font-medium truncate max-w-md">{image.title}</h2>
        <div className="flex gap-4">
          <button 
            onClick={onDelete}
            className="p-2 rounded-full transition-colors text-red-400 hover:text-red-200 hover:bg-red-900/20"
            title="Delete Image"
          >
            <TrashIcon className="w-6 h-6" />
          </button>

          <button 
            onClick={() => onVisualize(image)}
            className="p-2 rounded-full transition-colors text-purple-400 hover:text-purple-200 hover:bg-purple-900/20"
            title="Visualize in 3D"
          >
            <CubeTransparentIcon className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
            title="Image Info & AI Analysis"
          >
            <InformationCircleIcon className="w-6 h-6" />
          </button>
          
          <button 
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Area */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12">
        <div className="relative max-w-full max-h-full">
           <img 
            src={image.url} 
            alt={image.title}
            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-sm select-none"
          />
        </div>
      </div>

      {/* Navigation Buttons */}
      {hasPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <ChevronLeftIcon className="w-8 h-8" />
        </button>
      )}
      
      {hasNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <ChevronRightIcon className="w-8 h-8" />
        </button>
      )}

      {/* Info/Analysis Panel */}
      <div 
        className={`absolute right-0 top-0 bottom-0 w-full md:w-96 bg-gray-900/95 border-l border-gray-700 p-6 transform transition-transform duration-300 ease-in-out z-40 overflow-y-auto ${showInfo ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="mt-16 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Details</h3>
            <p className="text-gray-400 text-sm">Created: {new Date(image.createdAt).toLocaleDateString()}</p>
            <p className="text-gray-400 text-sm">Source: <span className="capitalize">{image.source}</span></p>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-purple-400" />
                Gemini Analysis
              </h3>
            </div>
            
            {!analysis && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium shadow-lg shadow-purple-900/20"
              >
                <SparklesIcon className="w-5 h-5" />
                Analyze Image
              </button>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                <p className="text-purple-300 text-sm animate-pulse">Analyzing visual data...</p>
              </div>
            )}

            {analysis && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-line mb-4">
                  {analysis}
                </p>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={handleSpeak}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${isSpeaking ? 'bg-purple-500/20 border-purple-500 text-purple-300 animate-pulse' : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'}`}
                        title="Read description aloud"
                    >
                        {isSpeaking ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                                Speaking...
                            </>
                        ) : (
                            <>
                                <SpeakerWaveIcon className="w-3.5 h-3.5" />
                                Read Aloud
                            </>
                        )}
                    </button>
                   
                   <button 
                    onClick={() => onGenerate(analysis)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-purple-500/50 text-purple-300 hover:bg-purple-500/20 transition-all"
                    title="Create a new image based on this description"
                   >
                     <PaintBrushIcon className="w-3.5 h-3.5" />
                     Remix
                   </button>

                   <button 
                    onClick={handleAnalyze}
                    className="text-xs text-gray-500 hover:text-gray-300 underline ml-auto"
                   >
                     Re-analyze
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;