import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckBadgeIcon, ShieldCheckIcon, UserPlusIcon, PhotoIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getConfirmInviteInfo, submitConfirmInviteDetails } from '../../api/confirm';
import { photoQualityChecker, photoEnhancer } from '../../utils/photoQualityChecker';
import CameraCapture from '../../components/shared/CameraCapture';
import { CameraIcon } from '@heroicons/react/24/outline';

const AttendeeIdentityConfirmPage = () => {
  const { inviteToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    photo: null,
  });
  const [preview, setPreview] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [allowOverride, setAllowOverride] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const smsEnabled = !!inviteInfo?.event?.smsEnabled;
  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const enhancedCanvasRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getConfirmInviteInfo(inviteToken);
        const data = response.data.data;
        setInviteInfo(data);
        setForm((prev) => ({
          ...prev,
          fullName: data?.attendee?.fullName || '',
          email: data?.attendee?.email || prev.email,
          phone: data?.attendee?.phone || prev.phone,
        }));
      } catch (err) {
        // handled by empty state below
      } finally {
        setLoading(false);
      }
    };

    if (inviteToken) load();
  }, [inviteToken]);

  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        if (!window.faceapi) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.crossOrigin = 'anonymous';
          document.body.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        const faceapiLib = window.faceapi;
        if (!faceapiLib) throw new Error('faceapi not available');

        const modelPaths = [
          '/models',
          'https://justadudewhohacks.github.io/face-api.js/models',
        ];

        let loaded = false;
        let lastError = null;
        for (const modelPath of modelPaths) {
          try {
            await faceapiLib.nets.ssdMobilenetv1.loadFromUri(modelPath);
            await faceapiLib.nets.faceLandmark68Net.loadFromUri(modelPath);
            await faceapiLib.nets.faceRecognitionNet.loadFromUri(modelPath);
            await faceapiLib.nets.faceExpressionNet.loadFromUri(modelPath);
            loaded = true;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!loaded) throw lastError || new Error('Unable to load face-api models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models', err);
        setModelLoadFailed(true);
        toast.error('Face matching is temporarily unavailable. You can still submit your photo.');
      }
    };

    loadFaceApi();
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const computeBrightness = (imageData) => {
    const { data } = imageData;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return total / (data.length / 4);
  };

  const computeSharpness = (imageData) => {
    const { data, width, height } = imageData;
    const toGray = (x, y) => {
      const i = (y * width + x) * 4;
      return (data[i] + data[i + 1] + data[i + 2]) / 3;
    };
    let sum = 0;
    let sumSq = 0;
    let pixels = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const gx =
          -1 * toGray(x - 1, y - 1) - 2 * toGray(x - 1, y) - 1 * toGray(x - 1, y + 1) +
          1 * toGray(x + 1, y - 1) + 2 * toGray(x + 1, y) + 1 * toGray(x + 1, y + 1);
        const gy =
          -1 * toGray(x - 1, y - 1) - 2 * toGray(x, y - 1) - 1 * toGray(x + 1, y - 1) +
          1 * toGray(x - 1, y + 1) + 2 * toGray(x, y + 1) + 1 * toGray(x + 1, y + 1);
        const mag = Math.sqrt(gx * gx + gy * gy);
        sum += mag;
        sumSq += mag * mag;
        pixels += 1;
      }
    }
    const mean = sum / pixels;
    return sumSq / pixels - mean * mean;
  };

  const drawBoundingBox = (box) => {
    const canvas = overlayRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !box) return;
    const ctx = canvas.getContext('2d');
    const ratio = img.naturalWidth / img.clientWidth;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x / ratio, box.y / ratio, box.width / ratio, box.height / ratio);
  };

  const analyzePhoto = async (file) => {
    if (!modelsLoaded) {
      return {
        faceCount: 0,
        confidence: 0,
        boundingBox: null,
        brightness: 0,
        sharpness: 0,
        descriptor: [],
        errors: [],
        skipped: true,
      };
    }

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const brightness = computeBrightness(imageData);
    const sharpness = computeSharpness(imageData);

    const faceapiLib = window.faceapi;
    const detection = await faceapiLib
      .detectSingleFace(img, new faceapiLib.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    const errors = [];
    let faceCount = 0;
    let confidence = 0;
    let boundingBox = null;
    let descriptor = [];

    if (!detection) {
      errors.push('No face detected');
    } else {
      faceCount = 1;
      confidence = detection.detection.score;
      boundingBox = detection.detection.box;
      descriptor = Array.from(detection.descriptor || []);
      if (!descriptor.length) errors.push('Face descriptor extraction failed');
    }

    return {
      faceCount,
      confidence,
      boundingBox,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      descriptor,
      errors,
    };
  };

  const applyEnhancementFilter = (filterType) => {
    if (!preview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = enhancedCanvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const enhancedDataURL = photoEnhancer.applyFilter(canvas, filterType);
      setEnhancedPreview(enhancedDataURL);
      setActiveFilter(filterType);
    };
    img.src = preview;
  };

  const resetPreview = () => {
    setEnhancedPreview(null);
    setActiveFilter('none');
  };

  const validatePhoto = async (file) => {
    const quality = await photoQualityChecker.analyzePhoto(file);
    setQualityAnalysis(quality);
    const allErrors = [...quality.errors, ...quality.warnings];
    const face = await analyzePhoto(file);
    setFaceAnalysis(face);
    if (face.errors.length > 0) allErrors.push(...face.errors);
    if (face.boundingBox && imageRef.current) drawBoundingBox(face.boundingBox);
    return allErrors;
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const errors = await validatePhoto(file);
    setValidationErrors(errors);
    setAllowOverride(errors.length > 0);
    setEnhancedPreview(null);
    setActiveFilter('none');
    setForm((prev) => ({ ...prev, photo: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName || !form.email) {
      toast.error('Full name and email are required.');
      return;
    }
    if (!form.photo) {
      toast.error('Please upload an identity verification photo.');
      return;
    }
    if (validationErrors.length > 0 && !allowOverride) {
      toast.error('Please fix photo validation issues or allow override.');
      return;
    }
    if (modelsLoaded && !faceAnalysis?.descriptor?.length) {
      toast.error('Unable to compute face descriptor; please try another photo.');
      return;
    }

    const payload = new FormData();
    payload.append('fullName', form.fullName);
    payload.append('idNumber', form.idNumber);
    payload.append('dateOfBirth', form.dateOfBirth);
    payload.append('email', form.email);
    payload.append('phone', form.phone);
    payload.append('photo', form.photo);
    payload.append('faceValidationPassed', String(validationErrors.length === 0 || allowOverride));
    payload.append('faceCount', String(faceAnalysis?.faceCount ?? 0));
    payload.append('faceConfidence', String(faceAnalysis?.confidence ?? 0));
    payload.append('brightness', String(faceAnalysis?.brightness ?? 0));
    payload.append('sharpness', String(faceAnalysis?.sharpness ?? 0));
    payload.append('faceDescriptor', JSON.stringify(faceAnalysis?.descriptor || []));
    payload.append('skipFaceMatch', String(!modelsLoaded || modelLoadFailed));

    setSubmitting(true);
    try {
      await submitConfirmInviteDetails(inviteToken, payload);
      setSubmitted(true);
      toast.success('Identity details submitted for verification.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm font-black uppercase tracking-widest text-slate-500">Verifying Secure Link...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!inviteInfo) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600">
            <InformationCircleIcon className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-950">Access Link Invalid</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-500">This invitation link has expired, been revoked, or already successfully used.</p>
        </div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <CheckBadgeIcon className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-950">Submission Received</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-500">
            Your identity details are under verification. You'll receive your final {inviteInfo?.attendee?.isPass ? 'Pass QR' : 'Ticket QR'} email once approved.
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-24">
        <div className="h-80 bg-slate-950 px-4 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-blue-500">Identity Verification</p>
            <h1 className="text-4xl font-black uppercase tracking-tight text-white sm:text-6xl">Secure Attendance</h1>
            <p className="mt-6 text-lg font-medium text-slate-400">
              Confirming {inviteInfo?.attendee?.isPass ? 'Pass' : 'Entry'} for <span className="font-bold text-white">{inviteInfo.event?.name}</span>
            </p>
          </div>
        </div>

        <div className="relative mx-auto -mt-16 max-w-4xl px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-slate-900 px-8 py-6">
              <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-wide text-white">
                <ShieldCheckIcon className="h-6 w-6 text-blue-500" />
                Attendee Profile Form
              </h2>
            </div>

            <div className="space-y-10 p-8 lg:p-12">
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Full Identity Name *</label>
                    <input type="text" value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-500 focus:bg-white focus:outline-none" placeholder="Current full name" required />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">NIC / Passport Number</label>
                    <input type="text" value={form.idNumber} onChange={(e) => handleChange('idNumber', e.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-500 focus:bg-white focus:outline-none" placeholder="For gate verification (Optional)" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-500 focus:bg-white focus:outline-none" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Email *</label>
                    <input type="email" value={form.email} readOnly className="w-full rounded-2xl border-2 border-slate-100 bg-slate-100 px-5 py-4 font-bold text-slate-500 cursor-not-allowed focus:outline-none" required />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number {smsEnabled ? '*' : '(Optional)'}</label>
                    <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required={smsEnabled} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-500 focus:bg-white focus:outline-none" placeholder={smsEnabled ? '+1234567890' : '+1234567890 (Optional)'} />
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity Photo (Selfie) *</label>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                        <label className="flex-1 group relative flex h-[132px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50">
                          {form.photo ? (
                            <div className="relative h-full w-full">
                              <img src={enhancedPreview || preview} alt="Preview" ref={imageRef} className="h-full w-full rounded-xl object-cover shadow-md" />
                              <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <PhotoIcon className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-4">
                              <PhotoIcon className="mb-2 h-8 w-8 text-slate-300 transition-colors group-hover:text-blue-500" />
                              <p className="text-[10px] text-center font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Upload Photo</p>
                            </div>
                          )}
                          <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                        </label>

                        <button
                          type="button"
                          onClick={() => setShowCamera(true)}
                          className="flex-1 group relative flex h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50"
                        >
                          <CameraIcon className="mb-2 h-8 w-8 text-slate-300 transition-colors group-hover:text-blue-500" />
                          <p className="text-[10px] text-center font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Take Live Photo</p>
                        </button>
                      </div>
                      
                      {showCamera && (
                        <CameraCapture 
                          onCapture={async (file) => {
                            const errors = await validatePhoto(file);
                            setValidationErrors(errors);
                            setAllowOverride(errors.length > 0);
                            setEnhancedPreview(null);
                            setActiveFilter('none');
                            setForm((prev) => ({ ...prev, photo: file }));
                            setPreview(URL.createObjectURL(file));
                          }} 
                          onClose={() => setShowCamera(false)} 
                        />
                      )}
                    </div>
                    {modelLoadFailed && <p className="text-sm text-amber-700">Advanced face matching is temporarily unavailable. Your photo can still be submitted for manual review.</p>}
                  </div>
                </div>
              </div>

              {qualityAnalysis && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-bold text-slate-900">Photo Quality: {qualityAnalysis.qualityRating?.rating || 'Pending'}</span>
                    <span className="text-sm font-semibold text-slate-600">Score {qualityAnalysis.qualityRating?.score || 0}%</span>
                  </div>
                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    {qualityAnalysis.resolution && <div>Resolution: {qualityAnalysis.resolution.dimensions?.width}x{qualityAnalysis.resolution.dimensions?.height}</div>}
                    {qualityAnalysis.brightness && <div>Brightness: {qualityAnalysis.brightness.brightness}</div>}
                    {qualityAnalysis.blur && <div>Sharpness: {qualityAnalysis.blur.sharpness}</div>}
                    {qualityAnalysis.contrast && <div>Contrast: {qualityAnalysis.contrast.contrast}</div>}
                    {faceAnalysis && <div>Face count: {faceAnalysis.faceCount}</div>}
                    {faceAnalysis && <div>Face confidence: {(faceAnalysis.confidence * 100).toFixed(1)}%</div>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={resetPreview} className={`rounded px-3 py-1 text-xs ${activeFilter === 'none' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Original</button>
                    <button type="button" onClick={() => applyEnhancementFilter('brighten')} className={`rounded px-3 py-1 text-xs ${activeFilter === 'brighten' ? 'bg-yellow-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Brighten</button>
                    <button type="button" onClick={() => applyEnhancementFilter('enhance')} className={`rounded px-3 py-1 text-xs ${activeFilter === 'enhance' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Enhance</button>
                    <button type="button" onClick={() => applyEnhancementFilter('vivid')} className={`rounded px-3 py-1 text-xs ${activeFilter === 'vivid' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Vivid</button>
                  </div>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <ul className="space-y-1 text-sm text-yellow-800">
                    {validationErrors.map((error, index) => <li key={index}>- {error}</li>)}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={allowOverride} onChange={(e) => setAllowOverride(e.target.checked)} />
                    Ignore warnings and proceed
                  </label>
                </div>
              )}

              <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-6 sm:flex-row">
                <div className="flex items-center gap-3 text-blue-600">
                  <CheckBadgeIcon className="h-5 w-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Secure Verification Link</span>
                </div>
                <button type="submit" disabled={submitting || (validationErrors.length > 0 && !allowOverride)} className="w-full rounded-full bg-slate-950 px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl transition hover:bg-blue-600 disabled:opacity-50 active:scale-95 sm:w-auto">
                  {submitting ? 'Authenticating...' : 'Confirm My Identity'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default AttendeeIdentityConfirmPage;
