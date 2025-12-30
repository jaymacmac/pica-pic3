import React, { useState, useEffect } from 'react';
import { XMarkIcon, LinkIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline';
import { isGitHubUrl, getImagesFromGitHub } from '../services/githubService';

interface AddUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (urls: string[]) => void;
}

const AddUrlModal: React.FC<AddUrlModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isGithub, setIsGithub] = useState(false);

  useEffect(() => {
    setIsGithub(isGitHubUrl(url));
    setStatusMessage(null);
  }, [url]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (isGithub) {
        setStatusMessage("Scanning GitHub repository for images...");
        const images = await getImagesFromGitHub(url);
        
        if (images.length === 0) {
          setStatusMessage("No images found in this location.");
          setIsLoading(false);
          return;
        }

        onAdd(images);
        setStatusMessage(`Found and added ${images.length} images!`);
        
        // Small delay to let user read success message
        setTimeout(() => {
            setUrl('');
            setStatusMessage(null);
            setIsLoading(false);
            onClose();
        }, 1500);

      } else {
        // Standard URL
        onAdd([url.trim()]);
        setUrl('');
        setIsLoading(false);
        onClose();
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to process URL.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            {isGithub ? <CloudArrowDownIcon className="w-5 h-5 text-purple-500" /> : <LinkIcon className="w-5 h-5 text-blue-500" />}
            {isGithub ? 'Import from GitHub' : 'Add Image from URL'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {isGithub ? 'GitHub Repository / Folder URL' : 'Image URL'}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={isGithub ? "https://github.com/username/repo/tree/main/images" : "https://example.com/image.jpg"}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={isLoading}
            />
            {isGithub && (
               <p className="text-xs text-gray-500 mt-2">
                 We'll scan this GitHub page and import all image files found in the folder.
               </p>
            )}
          </div>

          {statusMessage && (
            <div className={`text-sm ${statusMessage.includes('Found') ? 'text-green-400' : statusMessage.includes('No') || statusMessage.includes('Failed') ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>
              {statusMessage}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!url.trim() || isLoading}
              className={`
                px-6 py-2.5 rounded-xl font-medium text-white shadow-lg transition-all
                ${isGithub 
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30' 
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isLoading ? 'Processing...' : (isGithub ? 'Import All Images' : 'Add Image')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUrlModal;