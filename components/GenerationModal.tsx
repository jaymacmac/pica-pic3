import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon, KeyIcon, BoltIcon, StarIcon, Square2StackIcon, TvIcon, DevicePhoneMobileIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { generateImage } from '../services/geminiService';

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (data: { base64: string, prompt: string, mimeType: string }) => void;
  initialPrompt?: string;
}

type AspectRatio = '1:1' | '16:9' | '9:16';

// Define the available style presets
const STYLE_PRESETS = [
  { label: "Original", suffix: "" },
  { label: "Calming", suffix: ", minimalist, calming, simple, clean lines, soft lighting" },
  { label: "Vibrant", suffix: ", vivid, high contrast, neon, dramatic lighting" },
  { label: "Vintage", suffix: ", vintage, retro style, warm tones, pastel color palette" },
  { label: "Cyberpunk", suffix: ", cyberpunk, futuristic, neon lights, high tech, dark atmosphere, cyan and magenta" },
  { label: "Watercolor", suffix: ", watercolor painting style, artistic, soft blended colors, white background, dreamy" },
  { label: "Noir", suffix: ", film noir style, black and white, high contrast, cinematic shadows, dramatic, mysterious" },
  { label: "Psychedelic", suffix: ", psychedelic, swirling colors, trippy, abstract, vibrant patterns, hallucinogenic style" }
];

const GenerationModal: React.FC<GenerationModalProps> = ({ isOpen, onClose, onImageGenerated, initialPrompt }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Model selection state
  const [usePro, setUsePro] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Aspect Ratio State
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  
  // Variations State (Number of outputs)
  const [variationCount, setVariationCount] = useState(1);

  // Check for API key availability when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      checkApiKey();
    }
  }, [isOpen]);

  // Load initial prompt if provided (e.g. from Remix)
  useEffect(() => {
    if (isOpen && initialPrompt) {
        setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  const checkApiKey = async () => {
    // Cast window to any to access custom aistudio property
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.hasSelectedApiKey) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } else {
      // Fallback if not in the expected environment, assume env key works for flash
      setHasApiKey(true);
    }
  };

  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      try {
        await aiStudio.openSelectKey();
        // Assume success if no error, check status again
        setHasApiKey(true);
        setError(null);
      } catch (e) {
        console.error("Key selection failed", e);
        setError("Failed to select API key. Please try again.");
      }
    }
  };

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      if (variationCount > 1) {
        // Pick the top N styles
        const selectedStyles = STYLE_PRESETS.slice(0, variationCount);

        // Create an array of promises to run in parallel
        const promises = selectedStyles.map(async (style) => {
            try {
                const finalPrompt = prompt + style.suffix;
                // Add label to prompt only if it's not original to avoid clutter
                const promptLabel = style.label === "Original" ? prompt : `${prompt} (${style.label})`;
                
                const { base64, mimeType } = await generateImage(finalPrompt, { 
                    usePro: usePro,
                    aspectRatio: aspectRatio 
                });
                onImageGenerated({ base64, prompt: promptLabel, mimeType });
            } catch (err) {
                console.error(`Failed to generate variation: ${style.label}`, err);
            }
        });

        await Promise.all(promises);
      } else {
        // Single Image Generation (Original)
        const { base64, mimeType } = await generateImage(prompt, { 
            usePro: usePro,
            aspectRatio: aspectRatio 
        });
        onImageGenerated({ base64, prompt, mimeType });
      }

      setPrompt('');
      onClose();
    } catch (err: any) {
        console.error(err);
        if (err.message && err.message.includes("Requested entity was not found")) {
            setError("Session expired. Please select your API key again.");
            setHasApiKey(false);
        } else {
            setError("Failed to generate image. Please check your connection and try again.");
        }
    } finally {
      setIsGenerating(false);
    }
  };

  // Only force key selection if using Pro mode AND key is missing
  // Standard mode skips this check to allow frictionless usage (assuming env key or free tier works)
  const showApiKeyWarning = !hasApiKey && usePro;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-purple-500" />
            Generate with Gemini
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Settings Row: Model & Ratio */}
          <div className="space-y-4">
            {/* Model Selection Tabs */}
            <div className="bg-gray-950 p-1 rounded-xl flex">
              <button
                type="button"
                onClick={() => setUsePro(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${!usePro ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <BoltIcon className="w-4 h-4" />
                Standard
              </button>
              <button
                type="button"
                onClick={() => setUsePro(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${usePro ? 'bg-gradient-to-r from-purple-900/50 to-blue-900/50 text-white shadow-sm border border-purple-500/30' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <StarIcon className="w-4 h-4 text-yellow-400" />
                Pro (HQ)
              </button>
            </div>

            {/* Aspect Ratio & Variations Controls */}
            <div className="flex flex-col gap-3">
                {/* Aspect Ratio */}
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Aspect Ratio</span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setAspectRatio('1:1')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${aspectRatio === '1:1' ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <Square2StackIcon className="w-3.5 h-3.5" />
                            1:1
                        </button>
                        <button
                            type="button"
                            onClick={() => setAspectRatio('16:9')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${aspectRatio === '16:9' ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <TvIcon className="w-3.5 h-3.5" />
                            16:9
                        </button>
                        <button
                            type="button"
                            onClick={() => setAspectRatio('9:16')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${aspectRatio === '9:16' ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
                            9:16
                        </button>
                    </div>
                </div>

                {/* Variation Count Selector */}
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        Variations
                        <RectangleStackIcon className="w-3 h-3" />
                    </span>
                    <div className="flex bg-gray-950 p-1 rounded-lg">
                        {[1, 2, 4, 8].map((count) => (
                            <button
                                key={count}
                                type="button"
                                onClick={() => setVariationCount(count)}
                                className={`
                                    w-8 h-7 text-xs font-medium rounded-md transition-all
                                    ${variationCount === count 
                                        ? 'bg-purple-600 text-white shadow-sm' 
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }
                                `}
                                title={`Generate ${count} image${count > 1 ? 's' : ''}`}
                            >
                                {count}x
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Visual feedback for selected styles */}
                {variationCount > 1 && (
                     <div className="flex flex-wrap gap-1.5 mt-1 bg-gray-950/50 p-2 rounded-lg border border-gray-800/50">
                        {STYLE_PRESETS.slice(0, variationCount).map((s, i) => (
                            <span key={i} className="text-[10px] bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                                {s.label}
                            </span>
                        ))}
                     </div>
                )}
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={usePro ? "Detailed portrait of a cyberpunk street warrior, 2K resolution, cinematic lighting..." : "A cute robot holding a flower..."}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] resize-none"
                disabled={isGenerating}
              />
            </div>
            
            {error && <p className="text-red-400 text-sm bg-red-900/10 p-2 rounded border border-red-900/30">{error}</p>}

            {/* API Key Requirement - Only show if using PRO and no key */}
            {showApiKeyWarning ? (
               <div className="bg-gray-800/50 border border-purple-500/30 rounded-xl p-4 space-y-3">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <KeyIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-white">Connect Google Cloud Project</h4>
                        <p className="text-xs text-gray-400 mt-1">
                            To use High-Quality (Pro) mode, you must select a Google Cloud Project.
                        </p>
                    </div>
                 </div>
                 <button
                    type="button"
                    onClick={handleSelectKey}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-600"
                 >
                    Select Cloud Project
                 </button>
                 <div className="text-center">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[10px] text-gray-500 hover:text-gray-400 underline">
                        Learn more about billing
                    </a>
                 </div>
               </div>
            ) : (
                <div className="flex justify-end pt-2">
                    <button
                    type="submit"
                    disabled={isGenerating || !prompt.trim()}
                    className={`
                        w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-white shadow-lg 
                        flex items-center justify-center gap-2 transition-all
                        ${isGenerating || !prompt.trim() 
                        ? 'bg-gray-700 cursor-not-allowed text-gray-400' 
                        : usePro 
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-900/30'
                            : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
                        }
                    `}
                    >
                    {isGenerating ? (
                        <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {variationCount > 1 ? `Generating ${variationCount}x...` : 'Generating...'}
                        </>
                    ) : (
                        <>
                        <SparklesIcon className="w-5 h-5" />
                        {variationCount > 1 ? `Generate ${variationCount} Styles` : 'Generate'}
                        </>
                    )}
                    </button>
                </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default GenerationModal;