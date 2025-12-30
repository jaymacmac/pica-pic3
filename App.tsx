import React, { useState, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import GalleryGrid from './components/GalleryGrid';
import ImageViewer from './components/ImageViewer';
import GenerationModal from './components/GenerationModal';
import AddUrlModal from './components/AddUrlModal';
import ExportModal from './components/ExportModal';
import RepoCleanupModal from './components/RepoCleanupModal';
import VisualizerTab from './components/Visualizer/VisualizerTab';
import { ImageItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { getImagesFromGitHub, convertUrlToBase64Simple } from './services/githubService';
import { analyzeForVisualizer } from './services/geminiService';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tab State
  const [activeTab, setActiveTab] = useState<'gallery' | 'visualizer'>('gallery');

  const [isGenerationOpen, setIsGenerationOpen] = useState(false);
  const [initialGenerationPrompt, setInitialGenerationPrompt] = useState('');
  const [isAddUrlOpen, setIsAddUrlOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Visualizer Tab State (passed down)
  const [visualizerStartingPrompt, setVisualizerStartingPrompt] = useState<string | null>(null);

  // Initial load from GitHub repo
  useEffect(() => {
    const loadDefaultImages = async () => {
      setIsLoading(true);
      try {
        // Load from the SOURCE repository
        const repoUrl = 'https://github.com/jaymacmac/pics/tree/main/lumina-exports';
        const urls = await getImagesFromGitHub(repoUrl);
        
        if (urls.length > 0) {
          const newImages: ImageItem[] = urls.map(url => ({
            id: uuidv4(),
            url: url,
            thumbnailUrl: url,
            title: url.split('/').pop()?.split('.')[0] || 'Image',
            createdAt: Date.now(),
            source: 'url'
          }));
          setImages(newImages);
        }
      } catch (error) {
        console.error("Failed to load initial images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDefaultImages();
  }, []);

  // File Upload Handler
  const handleUpload = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];
        
        const newImage: ImageItem = {
          id: uuidv4(),
          url: base64,
          thumbnailUrl: base64,
          title: file.name.split('.')[0],
          createdAt: Date.now(),
          source: 'upload',
          base64Data: base64Data,
          mimeType: file.type // Store mimeType for export
        };
        setImages(prev => [newImage, ...prev]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Add URL Handler (Single or Bulk)
  const handleAddUrl = useCallback((urls: string[]) => {
    const newImages: ImageItem[] = urls.map(url => ({
      id: uuidv4(),
      url: url,
      thumbnailUrl: url,
      title: url.split('/').pop()?.split('.')[0] || 'Image from URL',
      description: 'Added via URL import',
      createdAt: Date.now(),
      source: 'url'
    }));
    
    setImages(prev => [...newImages, ...prev]);
  }, []);

  // AI Generation Handler
  const handleImageGenerated = useCallback((data: { base64: string, prompt: string, mimeType: string }) => {
    const fullDataUrl = `data:${data.mimeType};base64,${data.base64}`;
    const newImage: ImageItem = {
      id: uuidv4(),
      url: fullDataUrl,
      thumbnailUrl: fullDataUrl,
      title: data.prompt.slice(0, 30) + (data.prompt.length > 30 ? '...' : ''),
      description: `Generated from prompt: "${data.prompt}"`,
      createdAt: Date.now(),
      source: 'generated',
      base64Data: data.base64,
      mimeType: data.mimeType
    };
    setImages(prev => [newImage, ...prev]);
    
    // Automatically close the Viewer if it was open (Remix flow) to show the main gallery
    setSelectedImageId(null);
  }, []);

  // Handle "Remix" from ImageViewer
  const handleGenerateWithPrompt = useCallback((prompt: string) => {
    setInitialGenerationPrompt(prompt);
    setIsGenerationOpen(true);
  }, []);

  // Handle "Visualize in 3D" from ImageViewer
  const handleVisualize = useCallback(async (image: ImageItem) => {
    try {
        setIsLoading(true);
        // 1. Get Base64 if missing
        let base64 = image.base64Data;
        if (!base64) {
            base64 = await convertUrlToBase64Simple(image.url);
        }

        // 2. Analyze using specific visualizer prompt
        const analysis = await analyzeForVisualizer(base64);

        // 3. Set prompt state and switch tab
        setVisualizerStartingPrompt(analysis);
        setSelectedImageId(null); // Close viewer
        setActiveTab('visualizer');

    } catch (e) {
        console.error("Failed to prepare visualizer:", e);
        alert("Could not analyze image for visualization.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Selection Logic
  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} images?`)) {
      setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
      setSelectedIds(new Set());
    }
  }, [selectedIds]);

  const handleDeleteSingle = useCallback((id: string) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      setImages(prev => prev.filter(img => img.id !== id));
      setSelectedImageId(null);
      // Also remove from selection if it was there
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  // Navigation Logic
  const getSelectedIndex = () => images.findIndex(img => img.id === selectedImageId);
  const selectedIndex = getSelectedIndex();
  const selectedImage = selectedIndex !== -1 ? images[selectedIndex] : null;

  const handleNext = () => {
    if (selectedIndex < images.length - 1) {
      setSelectedImageId(images[selectedIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedImageId(images[selectedIndex - 1].id);
    }
  };

  // Determine which images to export (Selected OR All)
  const imagesToExport = selectedIds.size > 0 
    ? images.filter(img => selectedIds.has(img.id))
    : images;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      <Toolbar 
        onUpload={handleUpload}
        onOpenGenerate={() => setIsGenerationOpen(true)}
        onOpenAddUrl={() => setIsAddUrlOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenCleanup={() => setIsCleanupOpen(true)}
        selectedCount={selectedIds.size}
        onDeselectAll={handleDeselectAll}
        onDeleteSelected={handleDeleteSelected}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 container mx-auto max-w-7xl relative">
        {activeTab === 'gallery' ? (
           isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center pt-20 z-40">
                <LoadingSpinner />
                <span className="ml-2 text-gray-400">Loading...</span>
            </div>
          ) : (
              <GalleryGrid 
                images={images} 
                onImageClick={(img) => setSelectedImageId(img.id)}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
              />
          )
        ) : (
          <VisualizerTab initialPrompt={visualizerStartingPrompt} />
        )}
      </main>

      {/* Lightbox / Viewer - Only visible in Gallery mode */}
      {selectedImage && activeTab === 'gallery' && (
        <ImageViewer
          image={selectedImage}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImageId(null)}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={selectedIndex < images.length - 1}
          hasPrev={selectedIndex > 0}
          onDelete={() => handleDeleteSingle(selectedImage.id)}
          onGenerate={handleGenerateWithPrompt}
          onVisualize={handleVisualize}
        />
      )}

      {/* Generation Modal */}
      <GenerationModal 
        isOpen={isGenerationOpen}
        onClose={() => {
            setIsGenerationOpen(false);
            setInitialGenerationPrompt(''); // Clear prompt on close
        }}
        onImageGenerated={handleImageGenerated}
        initialPrompt={initialGenerationPrompt}
      />

      {/* Add URL Modal */}
      <AddUrlModal
        isOpen={isAddUrlOpen}
        onClose={() => setIsAddUrlOpen(false)}
        onAdd={handleAddUrl}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        images={imagesToExport}
      />

      {/* Repo Cleanup Modal */}
      <RepoCleanupModal
        isOpen={isCleanupOpen}
        onClose={() => setIsCleanupOpen(false)}
      />
    </div>
  );
};

export default App;