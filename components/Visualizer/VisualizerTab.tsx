import React, { useState, useRef, useEffect } from 'react';
import BabylonScene from './BabylonScene';
import { generateSceneCode } from '../../services/geminiService';
import { 
  PlayIcon, 
  CodeBracketIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon, 
  BugAntIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../LoadingSpinner';

interface Preset {
  name: string;
  prompt: string;
  code: string;
}

interface ExternalConfig {
  type: string;
  config: {
    backgroundMode: string;
    backgroundImage?: string;
    bgImageEffect?: string;
    bgImageIntensity?: number;
    colorTheme?: string;
  };
}

interface VisualizerTabProps {
  initialPrompt?: string | null;
}

const VisualizerTab: React.FC<VisualizerTabProps> = ({ initialPrompt }) => {
  const [prompt, setPrompt] = useState('A deep blue abstract background with slowly falling digital rain particles');
  const [code, setCode] = useState('');
  const [logs, setLogs] = useState<{type: 'error' | 'info', msg: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track if we have already auto-run the initial prompt to prevent loops
  const hasAutoRunRef = useRef(false);

  const addLog = (msg: string, type: 'error' | 'info' = 'info') => {
    setLogs(prev => [{type, msg}, ...prev]);
  };

  const generate = async (promptText: string) => {
    if (!promptText.trim()) return;

    setIsGenerating(true);
    addLog(`Generating code for: "${promptText}"...`, 'info');

    try {
      const generatedCode = await generateSceneCode(promptText);
      setCode(generatedCode);
      addLog("Code generated. Rendering scene...", 'info');
    } catch (err: any) {
      addLog(`Generation Failed: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await generate(prompt);
  };

  // Auto-run if initialPrompt is provided and hasn't been run yet
  useEffect(() => {
    if (initialPrompt && initialPrompt !== prompt && !hasAutoRunRef.current) {
        setPrompt(initialPrompt);
        hasAutoRunRef.current = true;
        generate(initialPrompt);
    }
  }, [initialPrompt]);

  const handleExport = () => {
    const preset: Preset = { name: "Visualizer Preset", prompt, code };
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-preset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("Preset exported.", 'info');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // 1. Handle External Config Format (phase_drift_background)
        if (json.type === 'phase_drift_background' && json.config) {
            const c = json.config;
            let newPrompt = `Create a static background visualizer with mode: '${c.backgroundMode}'.\n`;
            
            if (c.colorTheme) {
                newPrompt += `Color Theme: '${c.colorTheme}' (use matching colors for lights/fog/particles).\n`;
            }
            
            if (c.backgroundImage) {
                newPrompt += `IMPORTANT: Use this specific image URL for the background: "${c.backgroundImage}".\n`;
                newPrompt += `Method: Create a full-screen background (BABYLON.Layer or similar) using this image.\n`;
                
                if (c.bgImageEffect) {
                     newPrompt += `Effect style: ${c.bgImageEffect}.\n`;
                }
                if (c.bgImageIntensity !== undefined) {
                     newPrompt += `Image Opacity/Intensity: ${c.bgImageIntensity}.\n`;
                }
            } else {
                newPrompt += `Use procedural generation for the background (no image provided).\n`;
            }

            setPrompt(newPrompt);
            addLog(`Loaded config: ${c.backgroundMode} / ${c.colorTheme}`, 'info');
            
            // Auto trigger generation for convenience
            generate(newPrompt);

        // 2. Handle Standard Presets
        } else if (json.code) {
          setCode(json.code);
          setPrompt(json.prompt || '');
          addLog("Preset loaded successfully.", 'info');
        } else {
          throw new Error("Unknown file format");
        }
      } catch (err) {
        addLog("Failed to load file. Invalid JSON.", 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-950">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col p-4 z-10">
        <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
          <CodeBracketIcon className="w-5 h-5 text-purple-500" />
          Scene Prompt
        </h2>

        <form onSubmit={handleGenerate} className="flex flex-col gap-3 mb-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 h-32 resize-none"
            placeholder="Describe your scene (e.g., 'A spinning gold cube with particles')..."
          />
          <button
            type="submit"
            disabled={isGenerating}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-white transition-all
              ${isGenerating ? 'bg-gray-700 cursor-wait' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20'}
            `}
          >
            {isGenerating ? (
              <LoadingSpinner /> 
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Generate Scene
              </>
            )}
          </button>
        </form>

        <div className="border-t border-gray-800 pt-4 mb-4">
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Presets / Configs</h3>
           <div className="flex gap-2">
             <button 
               onClick={handleExport}
               disabled={!code}
               className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
             >
               <ArrowDownTrayIcon className="w-4 h-4" />
               Save
             </button>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
             >
               <ArrowUpTrayIcon className="w-4 h-4" />
               Load
             </button>
             <input 
               ref={fileInputRef}
               type="file" 
               accept=".json" 
               className="hidden" 
               onChange={handleImport} 
             />
           </div>
        </div>

        {/* Debug Console */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-gray-800 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <BugAntIcon className="w-3 h-3" />
            Console
          </h3>
          <div className="flex-1 bg-black/50 rounded-lg p-2 font-mono text-xs overflow-y-auto space-y-1">
            {logs.length === 0 && <span className="text-gray-600 italic">Ready...</span>}
            {logs.map((log, i) => (
              <div key={i} className={`${log.type === 'error' ? 'text-red-400' : 'text-green-400'} break-words`}>
                <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative bg-black">
        <BabylonScene 
          code={code} 
          onLog={(msg) => addLog(msg, 'info')}
          onError={(msg) => addLog(msg, 'error')}
        />
        
        {/* Overlay info if empty */}
        {!code && !isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10">
              <SparklesIcon className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
              <h3 className="text-xl font-medium text-white mb-1">AI Background Visualizer</h3>
              <p className="text-gray-400">Describe a background effect (e.g., 'Digital Rain', 'Nebula', 'Grid').</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizerTab;