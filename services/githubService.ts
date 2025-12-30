import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

interface GitHubFile {
  name: string;
  type: string;
  download_url: string;
  sha: string;
  path: string;
}

export const isGitHubUrl = (url: string): boolean => {
  return url.includes('github.com');
};

export const getImagesFromGitHub = async (url: string): Promise<string[]> => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2) return [];

    const owner = pathParts[0];
    const repo = pathParts[1];
    let path = '';
    let ref = ''; // branch

    if (pathParts[2] === 'tree') {
      ref = pathParts[3];
      path = pathParts.slice(4).join('/');
    }

    let apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      apiUrl += `?ref=${ref}`;
    }

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        if (url.includes('/blob/')) {
            const rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            return [rawUrl];
        }
        throw new Error('Failed to fetch from GitHub API');
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      if (data.type === 'file' && isImageFile(data.name)) {
        return [data.download_url];
      }
      return [];
    }

    const imageUrls = data
      .filter((file: GitHubFile) => file.type === 'file' && isImageFile(file.name))
      .map((file: GitHubFile) => file.download_url);

    return imageUrls;
  } catch (error) {
    console.error("GitHub fetch error:", error);
    if (url.includes('/blob/')) {
       return [url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')];
    }
    return [];
  }
};

// --- Repo Management (Authenticated) ---

export const getRepoFiles = async (token: string, owner: string, repo: string, path: string): Promise<GitHubFile[]> => {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repo contents: ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return []; // Should be a directory listing

  return data.filter((file: any) => file.type === 'file' && isImageFile(file.name));
};

export const deleteFileFromGitHub = async (
  token: string, 
  owner: string, 
  repo: string, 
  path: string, 
  sha: string,
  message: string = "Delete duplicate file"
): Promise<void> => {
  // Use encodeURI to ensure spaces and special characters in path are handled, but keeping structure valid
  // However, for API 'contents/path', the path segments should be encoded. 
  // Since 'path' here usually comes from the API response (e.g. 'folder/my image.png'), 
  // simply wrapping it in encodeURI works for most cases where forward slashes are delimiters.
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
  
  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      sha
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to delete file');
  }
};

// --- Helpers ---

const isImageFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '');
};

export const convertUrlToBase64Simple = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const uploadImageToGitHub = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  fileName: string,
  base64Content: string
): Promise<void> => {
  // Fix: Encode filename to handle spaces/special chars in URL
  const encodedFileName = encodeURIComponent(fileName);
  // Fix: Also ensure path is clean if provided
  const encodedPath = path ? path.split('/').map(p => encodeURIComponent(p)).join('/') + '/' : '';
  
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${encodedFileName}`;
  
  const body = {
    message: `Add ${fileName} via LuminaView`,
    content: base64Content,
  };

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to upload to GitHub');
  }
};