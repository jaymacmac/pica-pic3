import React, { useRef, useState, useEffect } from 'react';
import { SparklesIcon, ArrowUpTrayIcon, LinkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, CloudArrowUpIcon, TrashIcon, XCircleIcon, WrenchScrewdriverIcon, PhotoIcon, CubeTransparentIcon } from '@heroicons/react/24/outline';

interface ToolbarProps {
  onUpload: (files: FileList) => void;
  onOpenGenerate: () => void;
  onOpenAddUrl: () => void;
  onOpenExport: () => void;
  onOpenCleanup: () => void;
  selectedCount: number;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  activeTab: 'gallery' | 'visualizer';
  onTabChange: (tab: 'gallery' | 'visualizer') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onUpload, 
  onOpenGenerate, 
  onOpenAddUrl, 
  onOpenExport, 
  onOpenCleanup,
  selectedCount,
  onDeselectAll,
  onDeleteSelected,
  activeTab,
  onTabChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <nav className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-4">
        {selectedCount > 0 && activeTab === 'gallery' ? (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
            <button 
              onClick={onDeselectAll}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
            <span className="text-white font-medium">{selectedCount} Selected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden sm:block">
              LuminaView
            </h1>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="bg-gray-800 p-1 rounded-lg flex items-center gap-1 ml-4">
          <button
            onClick={() => onTabChange('gallery')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'gallery' 
                ? 'bg-gray-700 text-white shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <PhotoIcon className="w-4 h-4" />
            Gallery
          </button>
          <button
            onClick={() => onTabChange('visualizer')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'visualizer' 
                ? 'bg-purple-900/40 text-purple-200 shadow-sm' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CubeTransparentIcon className="w-4 h-4" />
            Visualizer
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Full Screen Toggle */}
        <button
          onClick={toggleFullScreen}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700"
          title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullscreen ? (
            <ArrowsPointingInIcon className="w-5 h-5" />
          ) : (
             <ArrowsPointingOutIcon className="w-5 h-5" />
          )}
        </button>

        {activeTab === 'gallery' && (
          <>
            {selectedCount > 0 && (
              <button
                onClick={onDeleteSelected}
                className="p-2 sm:px-4 sm:py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-200 hover:text-red-100 text-sm font-medium transition-colors border border-red-800/50 flex items-center gap-2 mr-2"
              >
                <TrashIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" 
              accept="image/*" 
              multiple 
            />
            
            <div className="h-6 w-px bg-gray-700 mx-1 hidden sm:block"></div>
            
            <button
              onClick={onOpenCleanup}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors border border-gray-700"
              title="Cleanup GitHub Duplicates"
            >
              <WrenchScrewdriverIcon className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenExport}
              className={`p-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-colors border flex items-center gap-2
                ${selectedCount > 0 
                    ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border-blue-500/30' 
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                }`}
              title={selectedCount > 0 ? "Export Selected" : "Export All"}
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              <span className="hidden sm:inline">
                {selectedCount > 0 ? 'Export Selected' : 'Export'}
              </span>
            </button>

            <div className={`flex items-center gap-2 sm:gap-3 ${selectedCount > 0 ? 'opacity-50 hover:opacity-100 transition-opacity' : ''}`}>
                <button
                onClick={onOpenAddUrl}
                className="p-2 sm:px-4 sm:py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors border border-gray-700 flex items-center gap-2"
                >
                <LinkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Add URL</span>
                </button>

                <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 sm:px-4 sm:py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors border border-gray-700 flex items-center gap-2"
                >
                <ArrowUpTrayIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
                </button>

                <button
                onClick={onOpenGenerate}
                className="p-2 sm:px-4 sm:py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors shadow-lg shadow-purple-900/30 flex items-center gap-2"
                >
                <SparklesIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Generate</span>
                </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Toolbar;