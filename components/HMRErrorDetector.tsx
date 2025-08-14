import { useEffect, useRef, useState } from 'react';

interface HMRErrorDetectorProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  onErrorDetected: (errors: Array<{ type: string; message: string; package?: string }>) => void;
  sandboxId?: string;
  autoFix?: boolean;
}

export default function HMRErrorDetector({ iframeRef, onErrorDetected, sandboxId, autoFix = true }: HMRErrorDetectorProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [lastFixedErrors, setLastFixedErrors] = useState<string[]>([]);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const autoFixErrors = async (errors: Array<{ type: string; message: string; package?: string }>) => {
    if (!autoFix || !sandboxId || isFixing) return;
    
    // Check if we've already tried to fix these errors
    const errorKey = errors.map(e => `${e.type}:${e.message}`).join('|');
    if (lastFixedErrors.includes(errorKey)) return;
    
    setIsFixing(true);
    setLastFixedErrors(prev => [...prev, errorKey]);
    
    try {
      console.log('[HMRErrorDetector] Auto-fixing errors:', errors);
      
      const response = await fetch('/api/auto-fix-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, errors })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[HMRErrorDetector] Auto-fix successful:', result.message);
        // Clear the error after a short delay to let the fix take effect
        setTimeout(() => {
          setLastFixedErrors(prev => prev.filter(key => key !== errorKey));
        }, 10000);
      } else {
        console.error('[HMRErrorDetector] Auto-fix failed:', result.error);
      }
    } catch (error) {
      console.error('[HMRErrorDetector] Auto-fix request failed:', error);
    } finally {
      setIsFixing(false);
    }
  };

  useEffect(() => {
    const checkForHMRErrors = () => {
      if (!iframeRef.current) return;

      try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) return;

        // Check for Vite error overlay
        const errorOverlay = iframeDoc.querySelector('vite-error-overlay');
        if (errorOverlay) {
          // Try to extract error message
          const messageElement = errorOverlay.shadowRoot?.querySelector('.message-body');
          if (messageElement) {
            const errorText = messageElement.textContent || '';
            
            const detectedErrors: Array<{ type: string; message: string; package?: string }> = [];
            
            // Parse import errors
            const importMatch = errorText.match(/Failed to resolve import "([^"]+)"/);
            if (importMatch) {
              const packageName = importMatch[1];
              if (!packageName.startsWith('.')) {
                // Extract base package name
                let finalPackage = packageName;
                if (packageName.startsWith('@')) {
                  const parts = packageName.split('/');
                  finalPackage = parts.length >= 2 ? parts.slice(0, 2).join('/') : packageName;
                } else {
                  finalPackage = packageName.split('/')[0];
                }

                detectedErrors.push({
                  type: 'npm-missing',
                  message: `Failed to resolve import "${packageName}"`,
                  package: finalPackage
                });
              }
            }
            
            // Parse syntax errors
            const syntaxMatch = errorText.match(/Transform failed with \d+ error/);
            if (syntaxMatch) {
              detectedErrors.push({
                type: 'syntax-error',
                message: 'Syntax error detected',
                package: undefined
              });
            }
            
            if (detectedErrors.length > 0) {
              onErrorDetected(detectedErrors);
              autoFixErrors(detectedErrors);
            }
          }
        }
      } catch (error) {
        // Cross-origin errors are expected, ignore them
      }
    };

    // Check immediately and then every 2 seconds
    checkForHMRErrors();
    checkIntervalRef.current = setInterval(checkForHMRErrors, 2000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [iframeRef, onErrorDetected]);

  return null;
}