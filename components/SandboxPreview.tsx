import { useState, useEffect, useRef } from 'react';
import { Loader2, ExternalLink, RefreshCw, Terminal, Wrench } from 'lucide-react';
import HMRErrorDetector from './HMRErrorDetector';

interface SandboxPreviewProps {
  sandboxId: string;
  port: number;
  type: 'vite' | 'nextjs' | 'console';
  output?: string;
  isLoading?: boolean;
}

export default function SandboxPreview({ 
  sandboxId, 
  port, 
  type, 
  output,
  isLoading = false 
}: SandboxPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showConsole, setShowConsole] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [detectedErrors, setDetectedErrors] = useState<Array<{ type: string; message: string; package?: string }>>([]);

  useEffect(() => {
    if (sandboxId && type !== 'console') {
      // In production, this would be the actual E2B sandbox URL
      // Format: https://{sandboxId}-{port}.e2b.dev
      setPreviewUrl(`https://${sandboxId}-${port}.e2b.dev`);
    }
  }, [sandboxId, port, type]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleManualAutoFix = async () => {
    if (!sandboxId) return;
    
    try {
      console.log('[SandboxPreview] Manual auto-fix triggered');
      
      // Common missing packages that often cause issues
      const commonErrors = [
        { type: 'npm-missing', message: 'Common React packages', package: 'react react-dom' },
        { type: 'npm-missing', message: 'Common UI packages', package: 'lucide-react' },
        { type: 'npm-missing', message: 'Common utility packages', package: 'clsx tailwind-merge' }
      ];
      
      const response = await fetch('/api/auto-fix-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, errors: commonErrors })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[SandboxPreview] Manual auto-fix successful:', result.message);
        // Refresh the iframe after a short delay
        setTimeout(() => {
          setIframeKey(prev => prev + 1);
        }, 2000);
      } else {
        console.error('[SandboxPreview] Manual auto-fix failed:', result.error);
      }
    } catch (error) {
      console.error('[SandboxPreview] Manual auto-fix request failed:', error);
    }
  };

  if (type === 'console') {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="font-mono text-sm whitespace-pre-wrap text-gray-300">
          {output || 'No output yet...'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview Controls */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 border border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            ⚡ Vite Preview
          </span>
          <code className="text-xs bg-gray-900 px-2 py-1 rounded text-blue-400">
            {previewUrl}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Toggle console"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={handleManualAutoFix}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-yellow-400"
            title="Auto-fix common issues"
          >
            <Wrench className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main Preview */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Starting Vite dev server...
              </p>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={previewUrl}
          className="w-full h-[600px] bg-white"
          title={`${type} preview`}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        
        {/* Error Detector */}
        <HMRErrorDetector
          iframeRef={iframeRef}
          onErrorDetected={setDetectedErrors}
          sandboxId={sandboxId}
          autoFix={true}
        />
      </div>

      {/* Console Output (Toggle) */}
      {showConsole && output && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-400">Console Output</span>
          </div>
          <div className="font-mono text-xs whitespace-pre-wrap text-gray-300 max-h-48 overflow-y-auto">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}