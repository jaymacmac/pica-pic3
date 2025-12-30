import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Helper to convert URL to Base64 (for analysis of remote images)
export const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const analyzeImage = async (base64Data: string, prompt: string = "Describe this image in detail."): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  // Re-initialize to ensure we use the latest key
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming jpeg for simplicity, or detect from context
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const analyzeForVisualizer = async (base64Data: string): Promise<string> => {
  const prompt = `
    Analyze this image and describe it as a prompt for a Babylon.js 3D background visualizer.
    Focus on:
    1. The dominant background colors (gradients, solid colors).
    2. Any atmospheric effects (fog, glow, darkness).
    3. Any particle-like elements (rain, snow, stars, floating dust, geometric shapes).
    
    Keep it concise and descriptive. Example output: "A deep purple gradient background with slowly rising glowing green particles and soft fog."
  `;
  return analyzeImage(base64Data, prompt);
};

interface GenerateImageOptions {
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
  usePro?: boolean;
}

export const generateImage = async (prompt: string, options: GenerateImageOptions = {}): Promise<{ base64: string, mimeType: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const { aspectRatio = '1:1', usePro = false } = options;

  const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  // Pro model supports explicit size configuration
  const imageConfig: any = {
    aspectRatio: aspectRatio,
  };

  if (usePro) {
    imageConfig.imageSize = '2K'; // Default to high quality for Pro
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: imageConfig
      }
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        };
      }
    }
    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data generated");
    }
    return base64Audio;
  } catch (error) {
    console.error("Speech generation failed:", error);
    throw error;
  }
};

// --- Visualizer Engine Generation ---

export const generateSceneCode = async (prompt: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = `
    You are an expert 3D graphics programmer using Babylon.js.
    Your task is to write a JavaScript function body that modifies a Babylon.js Scene based on the user's prompt.
    
    The function signature is:
    async function createScene(scene, canvas, engine) {
      // Your code here
    }

    THE GOAL: Create a STATIC BACKGROUND VISUALIZER.
    The view must be "FRONT-ON" (like a screen or wallpaper).
    
    Available Variables:
    - 'scene': The BABYLON.Scene object (already created).
    - 'canvas': The HTMLCanvasElement.
    - 'engine': The BABYLON.Engine object.
    - 'BABYLON': The BABYLON namespace is available.

    IMPORTANT RULES FOR TEXTURES/IMAGES:
    1. **PRIORITY**: If the user's prompt contains a specific image URL (e.g. from a configuration file), YOU MUST USE THAT URL for the background or main texture.
       - Example: "Use image 'https://...'" -> var layer = new BABYLON.Layer("bg", "https://...", scene, true);
    2. **FALLBACKS** (Only use these if no URL is provided in the prompt):
       - Ground: "https://www.babylonjs-playground.com/textures/ground.jpg"
       - Grass: "https://www.babylonjs-playground.com/textures/grass.png"
       - Skybox: "https://www.babylonjs-playground.com/textures/skybox/skybox"
       - Particles: "https://www.babylonjs-playground.com/textures/flare.png"

    Requirements:
    1. DO NOT create a new engine or scene. Use the provided 'scene'.
    2. CAMERA: Create a 'BABYLON.UniversalCamera' at (0, 0, -10) looking at (0, 0, 0). DO NOT attach controls (no mouse interaction).
    3. LIGHTING: Ensure there is appropriate lighting.
    4. MESHES/PARTICLES: 
       - If creating particles, ensure the emitter fills the screen 16:9.
       - Use 'BABYLON.MeshBuilder' for shapes.
    5. Return ONLY the code inside the function body.
    
    Example Prompt: "Digital rain"
    Example Output:
    var camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 0, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    // ... particle system code ...
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 1024 } // Use thinking for better logic generation
      }
    });

    let code = response.text || "";
    
    // Cleanup markdown if present
    code = code.replace(/```javascript/g, "").replace(/```/g, "").trim();
    
    return code;
  } catch (error) {
    console.error("Scene code generation failed:", error);
    throw error;
  }
};