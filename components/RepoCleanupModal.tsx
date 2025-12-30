import React, { useState } from 'react';
import { XMarkIcon, TrashIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { getRepoFiles, deleteFileFromGitHub } from '../services/githubService';

interface RepoCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DuplicateGroup {
  sha: string;
  files: { name: string; path: string; sha: string }[];
}

const RepoCleanupModal: React.FC<RepoCleanupModalProps> = ({ isOpen, onClose }) => {
  const [token, setToken] = useState('');
  const [repoStr, setRepoStr] = useState('jaymacmac/pics');
  const [folderPath, setFolderPath] = useState('lumina-exports');
  
  const [isScanning, setIsScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  // Helper to safely parse repo string
  const parseRepo = (str: string): [string, string] | null => {
    const parts = str.split('/');
    if (parts.length !== 2) return null;
    const owner = parts[0].trim();
    const repo = parts[1].trim();
    if (!owner || !repo) return null;
    return [owner, repo];
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    
    const repoParts = parseRepo(repoStr);
    if (!cleanToken || !repoParts) {
        setStatus("Please enter a valid Token and Repo (user/repo).");
        return;
    }

    const [owner, repo] = repoParts;

    setIsScanning(true);
    setStatus('Scanning repository for files...');
    setDuplicates([]);
    setSelectedToDelete(new Set());
    setShowConfirm(false);

    try {
      const files = await getRepoFiles(cleanToken, owner, repo, folderPath.trim());
      
      setStatus(`Found ${files.length} images. Analyzing content...`);

      // Group by SHA
      const shaMap = new Map<string, typeof files>();
      files.forEach(file => {
        const list = shaMap.get(file.sha) || [];
        list.push(file);
        shaMap.set(file.sha, list);
      });

      // Filter groups with > 1 file
      const dupes: DuplicateGroup[] = [];
      const toDelete = new Set<string>();

      shaMap.forEach((groupFiles, sha) => {
        if (groupFiles.length > 1) {
          // Sort by name length (ascending) - assume shortest name is the "original"
          // If lengths equal, sort alphabetically
          const sorted = [...groupFiles].sort((a, b) => {
            if (a.name.length !== b.name.length) return a.name.length - b.name.length;
            return a.name.localeCompare(b.name);
          });

          dupes.push({
            sha,
            files: sorted
          });

          // Mark all except the first (shortest/original) for deletion
          for (let i = 1; i < sorted.length; i++) {
            toDelete.add(sorted[i].path);
          }
        }
      });

      setDuplicates(dupes);
      setSelectedToDelete(toDelete);
      
      if (dupes.length === 0) {
        setStatus('No duplicates found! Your repo is clean.');
      } else {
        setStatus(`Found ${dupes.length} groups of duplicate images.`);
      }

    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const executeDelete = async () => {
    if (selectedToDelete.size === 0) return;
    
    // UI Confirmation is handled by the buttons now, so we proceed directly
    setIsDeleting(true);
    
    const cleanToken = token.trim();
    const repoParts = parseRepo(repoStr);

    if (!repoParts) {
        setStatus("Invalid repository format.");
        setIsDeleting(false);
        return;
    }
    const [owner, repo] = repoParts;
    
    let deletedCount = 0;
    let errorCount = 0;
    let lastError = "";
    
    const total = selectedToDelete.size;

    // Convert Set to Array for iteration
    const pathsToDelete = Array.from(selectedToDelete) as string[];

    for (const path of pathsToDelete) {
        try {
            // Find the file object to get the SHA (needed for deletion)
            let sha = '';
            for (const group of duplicates) {
                const f = group.files.find(f => f.path === path);
                if (f) {
                    sha = f.sha;
                    break;
                }
            }

            if (sha) {
                const fileName = path.split('/').pop();
                setStatus(`Deleting ${deletedCount + 1}/${total}: ${fileName}...`);
                
                await deleteFileFromGitHub(cleanToken, owner, repo, path, sha);
                deletedCount++;
            } else {
                console.warn(`Could not find SHA for ${path}`);
            }
        } catch (error: any) {
            console.error(`Failed to delete ${path}`, error);
            errorCount++;
            
            // Handle common 404 error which usually means permission denied for delete
            if (error.message && error.message.includes('Not Found')) {
                lastError = "404 Not Found (Check if Token has 'repo' or 'public_repo' write scope)";
            } else {
                lastError = error.message || "Unknown error";
            }
        }
    }

    if (errorCount > 0) {
        setStatus(`Completed with errors. Deleted: ${deletedCount}. Failed: ${errorCount}. Last Error: ${lastError}`);
    } else {
        setStatus(`Cleanup complete! Successfully deleted ${deletedCount} files.`);
    }
    
    setIsDeleting(false);
    setShowConfirm(false); // Reset confirmation state
    
    // Refresh scan to show updated state if successful
    if (errorCount === 0) {
        setTimeout(() => {
            handleScan({ preventDefault: () => {} } as any);
        }, 1500);
    }
  };

  const toggleSelection = (path: string) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <TrashIcon className="w-5 h-5 text-red-500" />
            Cleanup GitHub Duplicates
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleScan} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">GitHub Token</label>
                    <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Requires <code>repo</code> or <code>public_repo</code> scope.</p>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Repo (user/repo)</label>
                    <input
                    type="text"
                    value={repoStr}
                    onChange={(e) => setRepoStr(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                    />
                </div>
            </div>
             <div>
                <label className="block text-xs text-gray-500 mb-1">Folder Path</label>
                <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            <button
              type="submit"
              disabled={isScanning || isDeleting || showConfirm}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isScanning ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowPathIcon className="w-4 h-4" />}
              {isScanning ? 'Scanning...' : 'Scan for Duplicates'}
            </button>
          </form>

          {status && (
            <div className={`text-sm mb-4 text-center p-2 rounded bg-gray-950/50 border border-gray-800 ${status.includes('Error') || status.includes('Failed') || status.includes('404') ? 'text-red-400' : 'text-blue-400'}`}>
              {status}
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="space-y-4 pb-20">
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>Select duplicates to remove (Keep the original):</span>
                <span>{selectedToDelete.size} selected</span>
              </div>
              
              <div className="space-y-4">
                {duplicates.map((group) => (
                  <div key={group.sha} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex items-center gap-2 mb-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-gray-500 font-mono">SHA: {group.sha.substring(0, 10)}...</span>
                    </div>
                    <div className="space-y-1">
                      {group.files.map((file, idx) => {
                        const isSelected = selectedToDelete.has(file.path);
                        return (
                          <div 
                            key={file.path} 
                            onClick={() => !isDeleting && !showConfirm && toggleSelection(file.path)}
                            className={`
                              flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-colors
                              ${isSelected ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-green-900/20 hover:bg-green-900/30'}
                              ${(isDeleting || showConfirm) ? 'pointer-events-none opacity-80' : ''}
                            `}
                          >
                            <span className={`truncate ${isSelected ? 'text-red-200 line-through opacity-70' : 'text-green-200 font-medium'}`}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2">
                                {idx === 0 && !isSelected && <span className="text-[10px] bg-green-900 text-green-200 px-2 py-0.5 rounded">Keep</span>}
                                {isSelected ? (
                                    <TrashIcon className="w-4 h-4 text-red-400" />
                                ) : (
                                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Sticky Footer for Actions */}
        {duplicates.length > 0 && (
          <div className="p-4 bg-gray-900 border-t border-gray-800">
            {!showConfirm ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={isDeleting || selectedToDelete.size === 0}
                    className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                    <TrashIcon className="w-5 h-5" />
                    Delete {selectedToDelete.size} Duplicates
                </button>
            ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3 text-yellow-500 bg-yellow-900/20 p-3 rounded-xl border border-yellow-700/30">
                        <ExclamationCircleIcon className="w-6 h-6 flex-shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold">Permanent Deletion</p>
                            <p className="opacity-90">Are you sure you want to delete {selectedToDelete.size} files? This cannot be undone.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowConfirm(false)}
                            disabled={isDeleting}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeDelete}
                            disabled={isDeleting}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-900/30 transition-all flex justify-center items-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Yes, Delete'
                            )}
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoCleanupModal;