import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScannerComponent = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
}) => {
  const scannerRef = useRef(null);
  const elementIdRef = useRef(`reader-${Math.random().toString(36).slice(2, 10)}`);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const isRunningRef = useRef(false);
  const [status, setStatus] = useState('Starting camera...');

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    onScanErrorRef.current = onScanError;
  }, [onScanError]);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      const scanner = new Html5Qrcode(elementIdRef.current);
      scannerRef.current = scanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameras?.length) {
          setStatus('No camera found on this device.');
          onScanErrorRef.current?.('NotFoundError');
          return;
        }

        const backCamera = cameras.find((camera) =>
          /back|rear|environment/i.test(`${camera.label || ''}`)
        );

        setStatus('Point the camera at the attendee QR code.');
        await scanner.start(
          backCamera?.id || cameras[0].id,
          {
            fps,
            qrbox: { width: qrbox, height: qrbox },
            aspectRatio,
          },
          (decodedText, decodedResult) => {
            onScanSuccessRef.current?.(decodedText, decodedResult);
          },
          () => {}
        );
        isRunningRef.current = true;
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
  }, [aspectRatio, fps, qrbox]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        id={elementIdRef.current}
        className="min-h-[300px] w-full bg-black"
      />
      <div className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-500">
        {status}
      </div>
    </div>
  );
};

export default QRScannerComponent;
