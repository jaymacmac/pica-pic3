import React, { useState, useEffect } from 'react';
import { XMarkIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon, LockClosedIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { uploadImageToGitHub, convertUrlToBase64Simple } from '../services/githubService';
import { ImageItem } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, images }) => {
  const [token, setToken] = useState('');
  const [repoStr, setRepoStr] = useState('jaymacmac/pics');
  const [folderPath, setFolderPath] = useState('lumina-exports');
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError(null);
      setLogs([]);
      setProgress(0);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLogs([]);
    setSuccess(false);
    
    if (!token.trim()) {
      setError("Personal Access Token is required.");
      return;
    }
    
    const parts = repoStr.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError("Repository must be in 'username/repo' format.");
      return;
    }
    const [owner, repo] = parts;

    setIsUploading(true);
    setProgress(0);

    let successCount = 0;
    let failCount = 0;
    const usedNames = new Set<string>();

    try {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        setLogs(prev => [`Processing ${i + 1}/${images.length}: ${img.title}...`, ...prev.slice(0, 4)]);
        
        try {
          // 1. Get Base64 content
          let content = img.base64Data;
          if (!content) {
            content = await convertUrlToBase64Simple(img.url);
          }

          // 2. Generate Deterministic Filename
          const extension = img.mimeType ? img.mimeType.split('/')[1] : 'png';
          const safeTitle = img.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          
          // Base filename without random ID
          let fileName = `${safeTitle}.${extension}`;
          
          // Handle duplicates within the current export batch
          let counter = 1;
          while (usedNames.has(fileName)) {
            fileName = `${safeTitle}_${counter}.${extension}`;
            counter++;
          }
          usedNames.add(fileName);

          // 3. Upload
          // If the file already exists on GitHub, this call will typically fail (422) 
          // because we are not providing the SHA for update. 
          // This effectively prevents overwriting or creating duplicate junk files.
          await uploadImageToGitHub(token, owner, repo, folderPath, fileName, content);
          successCount++;
        } catch (err: any) {
          console.error(err);
          // 422 usually means file exists but we didn't provide SHA to update it.
          // We treat this as "Skipped/Exists" which is often what the user wants to avoid duplicates.
          const msg = err.message || '';
          if (msg.includes('sha') || msg.includes('422')) {
             setLogs(prev => [`Skipped: ${img.title} (Already exists)`, ...prev]);
          } else {
             failCount++;
             setLogs(prev => [`Failed: ${img.title} - ${msg}`, ...prev]);
          }
        }
        
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      setSuccess(true);
      setLogs(prev => [`DONE! Uploaded: ${successCount}, Failed/Skipped: ${failCount}`, ...prev]);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setLogs([]);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CloudArrowUpIcon className="w-5 h-5 text-green-500" />
            Export to GitHub
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!success ? (
            <form onSubmit={handleExport} className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-3 text-sm text-blue-200">
                You are about to export <strong>{images.length}</strong> images to <strong>{repoStr}</strong>.
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  GitHub Personal Access Token (Classic)
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required scope: <code>repo</code> (for private) or <code>public_repo</code>.
                </p>
                
                <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-900/10 rounded-lg border border-yellow-700/30">
                     <LockClosedIcon className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                     <p className="text-xs text-yellow-200/70 leading-relaxed">
                       <strong>Security Note:</strong> This token is <u>never stored</u>. It is sent directly to GitHub's API from your browser.
                     </p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Repository (username/repo)
                </label>
                <input
                  type="text"
                  value={repoStr}
                  onChange={(e) => setRepoStr(e.target.value)}
                  placeholder="jaymacmac/pics"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Folder Path (Optional)
                </label>
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="lumina-exports"
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm flex items-center gap-2 bg-red-900/10 p-2 rounded">
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {error}
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-500 transition-all duration-300" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
              )}

              {!isUploading && (
                  <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-green-900/30 transition-all"
                    >
                        Start Upload
                    </button>
                  </div>
              )}
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircleIcon className="w-16 h-16 text-green-500" />
                <h4 className="text-xl font-semibold text-white">Export Complete!</h4>
                <p className="text-gray-400 text-center">
                    Successfully finished processing your images.
                </p>
                <div className="bg-gray-950 rounded-lg p-3 w-full max-h-32 overflow-y-auto text-xs text-gray-500 font-mono">
                     {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                </div>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors border border-gray-700"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        New Export
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg transition-colors shadow-lg shadow-green-900/20"
                    >
                        Close
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;