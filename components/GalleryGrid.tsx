import React from 'react';
import { ImageItem } from '../types';
import { PhotoIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

interface GalleryGridProps {
  images: ImageItem[];
  onImageClick: (image: ImageItem) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
}

const GalleryGrid: React.FC<GalleryGridProps> = ({ images, onImageClick, selectedIds, onToggleSelection }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-500 animate-fade-in">
        <PhotoIcon className="w-24 h-24 mb-4 opacity-20" />
        <p className="text-xl font-light">No images found.</p>
        <p className="text-sm opacity-60 mt-2">Upload, generate, or add from URL to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
      {images.map((img, index) => {
        const isSelected = selectedIds.has(img.id);
        // Stagger animation delay up to a max limit to avoid long waits on huge lists
        const delay = Math.min(index * 50, 500);
        
        return (
          <div 
            key={img.id}
            style={{ animationDelay: `${delay}ms` }}
            className={`
              animate-fade-in-up opacity-0
              group relative block aspect-square overflow-hidden rounded-xl bg-gray-800 cursor-pointer 
              transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/10
              ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-950' : 'border border-transparent hover:border-gray-600'}
            `}
            onClick={() => onImageClick(img)}
          >
            <img
              src={img.thumbnailUrl || img.url}
              alt={img.title}
              loading="lazy"
              className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105 opacity-80' : 'group-hover:scale-110'}`}
            />
            
            {/* Selection Checkbox */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(img.id);
              }}
              className="absolute top-2 left-2 z-10 p-1 rounded-full hover:bg-black/20 transition-colors"
            >
              {isSelected ? (
                <CheckCircleIconSolid className="w-6 h-6 text-blue-500 drop-shadow-md bg-white rounded-full" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-white/70 drop-shadow-md hover:text-white" />
              )}
            </div>

            {/* Info Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
              <h3 className="text-white text-sm font-medium truncate">{img.title}</h3>
              <span className="text-xs text-gray-400 capitalize">{img.source}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GalleryGrid;