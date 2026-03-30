import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScannerComponent = ({ onScanSuccess, onScanError, fps = 10, qrbox = 250, aspectRatio = 1.0 }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Check if camera is available
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        const scanner = new Html5QrcodeScanner("reader", {
          fps,
          qrbox,
          aspectRatio,
          showTorchButtonIfSupported: true,
        }, false);

        scanner.render(onScanSuccess, (err) => {
          // Silent errors for frame failures, but log actual permission/hardware errors
          if (err?.includes("NotAllowedError") || err?.includes("NotFoundError")) {
             onScanError(err);
          }
        });

        return () => {
          scanner.clear().catch(e => console.error("Scanner clear error", e));
        };
      })
      .catch(err => {
        console.error("Camera access denied or unavailable", err);
        onScanError("Camera access denied. Please enable camera permissions in your browser.");
      });
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div id="reader" className="w-full"></div>
    </div>
  );
};

export default QRScannerComponent;
