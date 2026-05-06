import React, { useRef, useState, useCallback, useEffect } from 'react';
import { CameraIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';

const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' for front, 'environment' for back

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please ensure you have given permission.');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Mirror the image if using front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          onCapture(file);
          onClose();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-slate-800 shadow-2xl flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white border-b border-slate-700 bg-slate-800/50 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">Identity Verification</span>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-90"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Camera Feed Container - Flexible */}
        <div className="relative flex-1 min-h-0 bg-black overflow-hidden group">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="mb-4 rounded-full bg-rose-500/10 p-4">
                <XMarkIcon className="h-8 w-8 text-rose-500" />
              </div>
              <p className="text-sm font-bold max-w-xs">{error}</p>
              <Button 
                variant="outline" 
                className="mt-6 border-slate-600 text-slate-300 hover:bg-slate-700" 
                onClick={startCamera}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover transition-transform duration-700 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {/* Pro-grade Overlay guides */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[70%] aspect-[3/4] max-h-[80%] rounded-[4rem] border-2 border-dashed border-white/30 ring-[2000px] ring-slate-950/60 transition-all duration-500 group-hover:border-blue-500/50">
                   {/* Corner markers */}
                   <div className="absolute -top-1 -left-1 h-8 w-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl" />
                   <div className="absolute -top-1 -right-1 h-8 w-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl" />
                   <div className="absolute -bottom-1 -left-1 h-8 w-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl" />
                   <div className="absolute -bottom-1 -right-1 h-8 w-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl" />
                   
                   <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Align Face Here</p>
                   </div>
                </div>
              </div>
              
              {/* Top status bar */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/60 backdrop-blur border border-white/10">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
                    Live Feed • {facingMode === 'user' ? 'Front' : 'Rear'}
                 </p>
              </div>
            </>
          )}
        </div>

        {/* Controls Bar - Always Visible */}
        <div className="flex items-center justify-between p-6 bg-slate-900 border-t border-slate-800">
          <button
            onClick={toggleCamera}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all active:scale-90"
            title="Switch Camera"
          >
            <ArrowPathIcon className="h-6 w-6" />
          </button>
          
          <button
            onClick={capturePhoto}
            disabled={!!error || !stream}
            className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-800 bg-slate-950 p-1 transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100"
          >
            <div className="h-full w-full rounded-full bg-white transition-all group-hover:bg-blue-50 shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
            <div className="absolute -inset-1 rounded-full border border-white/10 animate-ping opacity-20 pointer-events-none" />
          </button>
          
          <div className="w-12" /> {/* Spacer for symmetry */}
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraCapture;
