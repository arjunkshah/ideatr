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
          console.log('[HMRErrorDetector] Found Vite error overlay');
          
          // Try to extract error message from shadow DOM
          const shadowRoot = errorOverlay.shadowRoot;
          if (shadowRoot) {
            const messageElement = shadowRoot.querySelector('.message-body') || 
                                  shadowRoot.querySelector('.error-message') ||
                                  shadowRoot.querySelector('[class*="message"]');
            
            if (messageElement) {
              const errorText = messageElement.textContent || '';
              console.log('[HMRErrorDetector] Error text:', errorText);
              
              const detectedErrors: Array<{ type: string; message: string; package?: string }> = [];
              
              // Parse import errors - multiple patterns
              const importPatterns = [
                /Failed to resolve import "([^"]+)"/,
                /Cannot resolve module "([^"]+)"/,
                /Module not found: "([^"]+)"/
              ];
              
              for (const pattern of importPatterns) {
                const importMatch = errorText.match(pattern);
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
                    break; // Only add once per error
                  }
                }
              }
              
              // Parse syntax errors
              const syntaxPatterns = [
                /Transform failed with \d+ error/,
                /SyntaxError:/,
                /Unexpected token/,
                /Parsing error/
              ];
              
              for (const pattern of syntaxPatterns) {
                if (pattern.test(errorText)) {
                  detectedErrors.push({
                    type: 'syntax-error',
                    message: 'Syntax error detected',
                    package: undefined
                  });
                  break;
                }
              }
              
              // Also check for network errors that might indicate missing packages
              if (errorText.includes('net::ERR_ABORTED') || errorText.includes('500')) {
                // This might be a missing CSS or JS file
                const fileMatch = errorText.match(/GET ([^ ]+) net::ERR_ABORTED/);
                if (fileMatch) {
                  const fileName = fileMatch[1];
                  if (fileName.includes('node_modules')) {
                    const packageMatch = fileName.match(/node_modules\/([^\/]+)/);
                    if (packageMatch) {
                      detectedErrors.push({
                        type: 'npm-missing',
                        message: `Missing package file: ${fileName}`,
                        package: packageMatch[1]
                      });
                    }
                  }
                }
              }
              
              if (detectedErrors.length > 0) {
                console.log('[HMRErrorDetector] Detected errors:', detectedErrors);
                onErrorDetected(detectedErrors);
                autoFixErrors(detectedErrors);
              }
            }
          }
        }
      } catch (error) {
        // Cross-origin errors are expected, ignore them
        console.log('[HMRErrorDetector] Cross-origin error (expected):', error);
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