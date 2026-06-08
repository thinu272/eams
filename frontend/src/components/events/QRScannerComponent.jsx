import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScannerComponent = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
  scanCooldownMs = 2000,
}) => {
  const scannerRef = useRef(null);
  const elementIdRef = useRef(`reader-${Math.random().toString(36).slice(2, 10)}`);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef({ value: '', timestamp: 0 });
  
  const [status, setStatus] = useState('Starting camera...');
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    onScanErrorRef.current = onScanError;
  }, [onScanError]);

  // Handle initialization and first start
  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      const scanner = new Html5Qrcode(elementIdRef.current);
      scannerRef.current = scanner;

      try {
        const cameraList = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameraList?.length) {
          setStatus('No camera found on this device.');
          onScanErrorRef.current?.('NotFoundError');
          return;
        }

        setCameras(cameraList);

        const backCamera = cameraList.find((camera) =>
          /back|rear|environment/i.test(`${camera.label || ''}`)
        );

        const selectedId = backCamera?.id || cameraList[0].id;
        setCurrentCameraId(selectedId);

        setStatus('Point the camera at the attendee QR code.');
        await scanner.start(
          selectedId,
          {
            fps,
            qrbox: { width: qrbox, height: qrbox },
            aspectRatio,
          },
          (decodedText, decodedResult) => {
            const now = Date.now();
            if (
              lastScanRef.current.value === decodedText &&
              now - lastScanRef.current.timestamp < scanCooldownMs
            ) {
              return;
            }
            lastScanRef.current = { value: decodedText, timestamp: now };
            onScanSuccessRef.current?.(decodedText, decodedResult);
          },
          () => {}
        );
        
        isRunningRef.current = true;

        // Detect torch support
        try {
          const track = scanner.getRunningTrack();
          if (track && track.getCapabilities) {
            const capabilities = track.getCapabilities();
            setHasTorch(!!capabilities?.torch);
          }
        } catch (err) {
          console.warn('Unable to query torch capabilities', err);
        }
      } catch (error) {
        if (!mounted) return;
        const message = `${error?.message || error || 'Unable to open camera.'}`;
        setStatus(message);
        isRunningRef.current = false;
        if (
          message.includes('NotAllowedError') ||
          message.includes('Permission') ||
          message.includes('NotFoundError')
        ) {
          onScanErrorRef.current?.(message);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      const currentScanner = scannerRef.current;
      scannerRef.current = null;

      if (currentScanner) {
        const safelyHandleAsyncResult = (result, callback) => {
          if (result?.then) {
            result.then(callback).catch(() => {});
            return;
          }
          callback();
        };

        const finalize = () => {
          try {
            const clearResult = currentScanner.clear();
            safelyHandleAsyncResult(clearResult, () => {});
          } catch (error) {
            // Ignore cleanup errors during React dev remounts.
          }
        };

        if (isRunningRef.current) {
          isRunningRef.current = false;
          try {
            const stopResult = currentScanner.stop();
            safelyHandleAsyncResult(stopResult, finalize);
          } catch (error) {
            finalize();
          }
        } else {
          finalize();
        }
      }
    };
  }, [aspectRatio, fps, qrbox, scanCooldownMs]);

  // Flashlight toggle
  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !isRunningRef.current || !hasTorch) return;

    try {
      const nextState = !isTorchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Flashlight toggle failed:', err);
    }
  };

  // Switch camera track
  const switchCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner || cameras.length <= 1) return;

    try {
      const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      
      setStatus('Switching camera feed...');
      setIsTorchOn(false);
      setHasTorch(false);

      if (isRunningRef.current) {
        await scanner.stop();
        isRunningRef.current = false;
      }

      setCurrentCameraId(nextCamera.id);

      await scanner.start(
        nextCamera.id,
        {
          fps,
          qrbox: { width: qrbox, height: qrbox },
          aspectRatio,
        },
        (decodedText, decodedResult) => {
          const now = Date.now();
          if (
            lastScanRef.current.value === decodedText &&
            now - lastScanRef.current.timestamp < scanCooldownMs
          ) {
            return;
          }
          lastScanRef.current = { value: decodedText, timestamp: now };
          onScanSuccessRef.current?.(decodedText, decodedResult);
        },
        () => {}
      );
      
      isRunningRef.current = true;
      setStatus('Point the camera at the attendee QR code.');

      // Query new track for torch
      try {
        const track = scanner.getRunningTrack();
        if (track && track.getCapabilities) {
          const capabilities = track.getCapabilities();
          setHasTorch(!!capabilities?.torch);
        }
      } catch (err) {
        console.warn('Unable to query torch capabilities', err);
      }
    } catch (error) {
      setStatus(`Switching camera failed: ${error.message || error}`);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-lg">
      <style dangerouslySetInnerHTML={{__html: `
        #${elementIdRef.current} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}} />
      <div className="relative w-full aspect-square md:aspect-[4/3] bg-black">
        <div
          id={elementIdRef.current}
          className="w-full h-full"
        />

        {/* Scan overlay grid lines */}
        <div className="absolute inset-0 border border-white/5 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-dashed border-cyan-400/50 rounded-2xl animate-pulse flex items-center justify-center">
            <div className="w-48 h-48 border border-cyan-300/30 rounded-xl" />
          </div>
        </div>
        
        {/* Floating controller overlays */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className="pointer-events-auto rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md p-3.5 transition border border-white/10 active:scale-95 shadow-md"
              title="Toggle Flashlight"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill={isTorchOn ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${isTorchOn ? 'text-yellow-300' : 'text-white'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </button>
          )}
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="pointer-events-auto rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md p-3.5 transition border border-white/10 active:scale-95 shadow-md ml-auto"
              title="Switch Camera Feed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-slate-800 bg-slate-950 px-4 py-3.5 text-center text-xs font-semibold text-slate-400 tracking-wide">
        {status}
      </div>
    </div>
  );
};

export default QRScannerComponent;
