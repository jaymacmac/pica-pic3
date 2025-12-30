import React, { useEffect, useRef } from 'react';

// Access the global BABYLON object loaded via script tag
const getBabylon = () => (window as any).BABYLON;

interface BabylonSceneProps {
  code: string;
  onError: (error: string) => void;
  onLog: (message: string) => void;
}

const BabylonScene: React.FC<BabylonSceneProps> = ({ code, onError, onLog }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);

  // Initialize Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const BABYLON = getBabylon();
    if (!BABYLON) {
      onError("Babylon.js failed to load.");
      return;
    }

    try {
      const engine = new BABYLON.Engine(canvasRef.current, true);
      engineRef.current = engine;

      // Initial Default Scene
      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1); // Dark clean background
      sceneRef.current = scene;

      // --- Default Setup (Static Background Mode) ---
      // Fixed camera, no controls (Background visualizer)
      const camera = new BABYLON.UniversalCamera("Camera", new BABYLON.Vector3(0, 0, -10), scene);
      camera.setTarget(BABYLON.Vector3.Zero());
      
      // Basic light so things are visible if user creates mesh
      new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      // Start Loop - CRITICAL FIX: Render sceneRef.current, not the closure variable
      engine.runRenderLoop(() => {
        if (sceneRef.current) {
          sceneRef.current.render();
        }
      });

      const handleResize = () => engine.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        engine.stopRenderLoop();
        if (sceneRef.current) sceneRef.current.dispose();
        engine.dispose();
      };
    } catch (e: any) {
      onError(`Initialization Error: ${e.message}`);
    }
  }, []);

  // Execute Dynamic Code
  useEffect(() => {
    // Only run if we have an engine and actual code (skip initial empty code)
    if (!engineRef.current || !code) return;

    const BABYLON = getBabylon();

    const runUserCode = async () => {
      const engine = engineRef.current!;
      const canvas = canvasRef.current!;

      // 1. Create new scene first
      const newScene = new BABYLON.Scene(engine);
      newScene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);
      
      // 2. Dispose old scene and swap ref
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      sceneRef.current = newScene;

      try {
        // 3. Execute generated code
        const execute = new Function('scene', 'canvas', 'engine', 'BABYLON', `
          return (async () => {
            try {
              ${code}
            } catch(e) {
              throw e;
            }
          })();
        `);

        await execute(newScene, canvas, engine, BABYLON);
        
        // 4. Robust Fallbacks for Background Visualizer
        // If the generated code didn't create a camera, create a FIXED one.
        if (!newScene.activeCamera) {
            const camera = new BABYLON.UniversalCamera("FallbackCamera", new BABYLON.Vector3(0, 0, -10), newScene);
            camera.setTarget(BABYLON.Vector3.Zero());
            // Intentionally DO NOT attach controls for background visuals
        }
        
        // Double check: light fallback
        if (newScene.lights.length === 0) {
             new BABYLON.HemisphericLight("fallbackLight", new BABYLON.Vector3(0, 1, 0), newScene);
        }

        onLog("Scene updated successfully.");

      } catch (e: any) {
        console.error(e);
        onError(`Runtime Error: ${e.message}`);
        
        // Error Fallback
        if (newScene.meshes.length === 0) {
             const box = BABYLON.MeshBuilder.CreateBox("ErrorBox", {}, newScene);
             const mat = new BABYLON.StandardMaterial("errMat", newScene);
             mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
             box.material = mat;
             
             if (!newScene.activeCamera) {
                const camera = new BABYLON.UniversalCamera("ErrorCam", new BABYLON.Vector3(0, 0, -10), newScene);
                camera.setTarget(BABYLON.Vector3.Zero());
             }
        }
      }
    };

    runUserCode();

  }, [code]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full touch-none outline-none" 
    />
  );
};

export default BabylonScene;