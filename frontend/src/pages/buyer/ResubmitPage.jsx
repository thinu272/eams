import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getResubmitInfo, resubmitPhoto } from '../../api/attendees';
import { photoQualityChecker, photoEnhancer } from '../../utils/photoQualityChecker';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import CameraCapture from '../../components/shared/CameraCapture';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

const ResubmitPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [attendee, setAttendee] = useState(null);
  const [event, setEvent] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(0.5);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [showCamera, setShowCamera] = useState(false);

  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const enhancedCanvasRef = useRef(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await getResubmitInfo(token);
        setAttendee(response.data.data.attendee);
        setEvent(response.data.data.event);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Invalid resubmit link');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [token, navigate]);

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

        if (!loaded) {
          throw lastError || new Error('Unable to load face-api models');
        }

        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models', err);
        setModelLoadFailed(true);
        toast.error('Face matching is temporarily unavailable. You can still resubmit your photo.');
      }
    };

    loadFaceApi();
  }, []);

  const computeBrightness = (imageData) => {
    const { data } = imageData;
    let total = 0;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      // luminosity method
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return total / (len / 4);
  };

  const computeSharpness = (imageData) => {
    const { data, width, height } = imageData;
    const toGray = (x, y) => {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      return (r + g + b) / 3;
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
    const variance = sumSq / pixels - mean * mean;
    return variance; // higher = sharper
  };

  const euclideanDistance = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  const similarityFromDistance = (distance) => {
    if (typeof distance !== 'number' || Number.isNaN(distance)) return 0;
    return Math.max(0, Math.min(1, 1 - distance));
  };

  const clampThreshold = (value) => {
    let threshold = Number(value);
    if (Number.isNaN(threshold)) threshold = 0.5;
    return Math.max(0.4, Math.min(0.6, threshold));
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
    const x = box.x / ratio;
    const y = box.y / ratio;
    const w = box.width / ratio;
    const h = box.height / ratio;
    ctx.strokeRect(x, y, w, h);
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
        matchDistance: null,
        matchSimilarity: null,
        matchThreshold: faceMatchThreshold,
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
    if (!faceapiLib) {
      return { faceCount: 0, confidence: 0, brightness: Math.round(brightness), sharpness: Math.round(sharpness), boundingBox: null, errors: ['Face API not loaded'] };
    }

    const detection = await faceapiLib
      .detectSingleFace(img, new faceapiLib.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    const errors = [];
    let faceCount = 0;
    let confidence = 0;
    let boundingBox = null;
    let descriptor = null;

    if (!detection) {
      errors.push('No face detected');
    } else {
      faceCount = 1;
      confidence = detection.detection.score;
      boundingBox = detection.detection.box;
      descriptor = Array.from(detection.descriptor);

      if (!descriptor.length) {
        errors.push('Face descriptor extraction failed');
      }

      if (attendee?.faceDescriptor && attendee.faceDescriptor.length > 0) {
        const distance = euclideanDistance(attendee.faceDescriptor, descriptor);
        const similarity = similarityFromDistance(distance);

        if (distance === null) {
          errors.push('Descriptor size mismatch for comparison');
        } else {
          if (similarity < faceMatchThreshold) {
            errors.push(
              `Face similarity too low (${(similarity * 100).toFixed(1)}%) against saved profile at threshold ${(faceMatchThreshold * 100).toFixed(1)}%`,
            );
          }
        }

        return {
          faceCount,
          confidence,
          boundingBox,
          brightness: Math.round(brightness),
          sharpness: Math.round(sharpness),
          descriptor,
          matchDistance: distance,
          matchSimilarity: similarity,
          matchThreshold: faceMatchThreshold,
          errors,
        };
      }
    }

    const analysis = {
      faceCount,
      confidence,
      boundingBox,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      descriptor,
      matchDistance: null,
      matchSimilarity: null,
      matchThreshold: faceMatchThreshold,
      errors,
    };

    return analysis;
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
    // Run quality check
    const analysis = await photoQualityChecker.analyzePhoto(file);
    setQualityAnalysis(analysis);

    const allErrors = [...analysis.errors, ...analysis.warnings];

    // Perform face analysis
    const faceAnalysisResult = await analyzePhoto(file);
    setFaceAnalysis(faceAnalysisResult);

    if (faceAnalysisResult.errors.length > 0) {
      allErrors.push(...faceAnalysisResult.errors);
    }

    if (faceAnalysisResult.boundingBox && imageRef.current) {
      drawBoundingBox(faceAnalysisResult.boundingBox);
    }

    return allErrors;
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const errors = await validatePhoto(file);
    setValidationErrors(errors);
    setAllowOverride(errors.length > 0);
    setEnhancedPreview(null);
    setActiveFilter('none');

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) {
      toast.error('Please select a photo');
      return;
    }
    if (validationErrors.length > 0 && !allowOverride) {
      toast.error('Please fix photo validation errors or enable override');
      return;
    }
    if (modelsLoaded && attendee?.faceDescriptor?.length > 0 && !faceAnalysis?.descriptor?.length) {
      toast.error('Unable to compute face descriptor; please try another photo');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('token', token);
      formData.append('faceValidationPassed', String(validationErrors.length === 0 || allowOverride));
      formData.append('faceCount', String(faceAnalysis?.faceCount ?? '0'));
      formData.append('faceConfidence', String(faceAnalysis?.confidence ?? '0'));
      formData.append('brightness', String(faceAnalysis?.brightness ?? '0'));
      formData.append('sharpness', String(faceAnalysis?.sharpness ?? '0'));
      formData.append('faceDescriptor', JSON.stringify(faceAnalysis?.descriptor || []));
      formData.append('threshold', String(faceMatchThreshold));
      formData.append('faceMatchDistance', String(faceAnalysis?.matchDistance ?? 0));
      formData.append('faceMatchSimilarity', String(faceAnalysis?.matchSimilarity ?? 0));
      formData.append('skipFaceMatch', String(!modelsLoaded || modelLoadFailed));
      await resubmitPhoto(formData);
      toast.success('Photo resubmitted for review');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resubmit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!attendee) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Resubmit Photo</h1>
          <p className="text-gray-600 mt-2">Your previous photo was rejected</p>
        </div>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="font-medium text-red-800">Rejection Reason</h3>
          <p className="text-red-700 mt-1">{attendee.rejectionReason}</p>
          <p className="text-sm text-red-600 mt-2">
            Resubmission {attendee.resubmitCount}/3
          </p>
        </div>

        {attendee.photo && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Previous Photo</h3>
            <img
              src={getAssetUrl(attendee.photo)}
              alt="Previous"
              className="w-full h-48 object-cover rounded-md border"
            />
          </div>
        )}

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-2">Photo Requirements</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Clear face visible</li>
            <li>• Good lighting</li>
            <li>• No blur or distortion</li>
            <li>• Recent photo</li>
            <li>• File size: 50KB - 5MB</li>
            <li>• Format: JPG or PNG</li>
          </ul>
          {modelLoadFailed && (
            <p className="mt-3 text-sm text-amber-700">
              Advanced face matching is temporarily unavailable. Your photo can still be submitted for manual review.
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Face-match Threshold ({(faceMatchThreshold * 100).toFixed(0)}%)</label>
          <input
            type="range"
            min="0.4"
            max="0.6"
            step="0.01"
            value={faceMatchThreshold}
            onChange={(e) => setFaceMatchThreshold(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Adjust similarity threshold between 0.4 and 0.6</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Provide New Photo
            </label>
            <div className="flex gap-3">
              <label className="flex-1 group relative flex h-[100px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-500 hover:bg-blue-50">
                <PhotoIcon className="h-6 w-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-2 group-hover:text-blue-700">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-1 group relative flex h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-500 hover:bg-blue-50"
              >
                <CameraIcon className="h-6 w-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-2 group-hover:text-blue-700">Live Camera</span>
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
                  setPhoto(file);
                  setPreview(URL.createObjectURL(file));
                }} 
                onClose={() => setShowCamera(false)} 
              />
            )}
          </div>

          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <ul className="text-sm text-yellow-800">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {preview && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Preview & Quality Analysis</h3>

              {/* Quality Rating */}
              {qualityAnalysis && (
                <div className="mb-3 p-3 rounded-md border-2" style={{
                  borderColor: {
                    'Good': '#10b981',
                    'Medium': '#f59e0b',
                    'Poor': '#ef4444',
                  }[qualityAnalysis.qualityRating?.rating] || '#d1d5db',
                  backgroundColor: {
                    'Good': '#ecfdf5',
                    'Medium': '#fffbeb',
                    'Poor': '#fef2f2',
                  }[qualityAnalysis.qualityRating?.rating] || '#f9fafb',
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium" style={{
                      color: {
                        'Good': '#059669',
                        'Medium': '#d97706',
                        'Poor': '#dc2626',
                      }[qualityAnalysis.qualityRating?.rating],
                    }}>
                      Quality: {qualityAnalysis.qualityRating?.rating}
                    </span>
                    <span className="text-xs font-semibold" style={{
                      color: {
                        'Good': '#059669',
                        'Medium': '#d97706',
                        'Poor': '#dc2626',
                      }[qualityAnalysis.qualityRating?.rating],
                    }}>
                      Score {qualityAnalysis.qualityRating?.score}%
                    </span>
                  </div>
                  
                  {/* Quality Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {qualityAnalysis.resolution && (
                      <div>
                        <span className="text-gray-600">Resolution:</span>
                        <span className={qualityAnalysis.resolution.valid ? 'text-green-600' : 'text-red-600'}>
                          {' '}{qualityAnalysis.resolution.dimensions?.width}x{qualityAnalysis.resolution.dimensions?.height}
                        </span>
                      </div>
                    )}
                    {qualityAnalysis.brightness && (
                      <div>
                        <span className="text-gray-600">Brightness:</span>
                        <span className={qualityAnalysis.brightness.valid ? 'text-green-600' : 'text-red-600'}>
                          {' '}{qualityAnalysis.brightness.brightness}
                        </span>
                      </div>
                    )}
                    {qualityAnalysis.blur && (
                      <div>
                        <span className="text-gray-600">Sharpness:</span>
                        <span className={qualityAnalysis.blur.valid ? 'text-green-600' : 'text-red-600'}>
                          {' '}{qualityAnalysis.blur.sharpness}
                        </span>
                      </div>
                    )}
                    {qualityAnalysis.contrast && (
                      <div>
                        <span className="text-gray-600">Contrast:</span>
                        <span className={qualityAnalysis.contrast.valid ? 'text-green-600' : 'text-red-600'}>
                          {' '}{qualityAnalysis.contrast.contrast}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Photo Preview */}
              <div className="relative mb-3 rounded-md overflow-hidden border border-gray-300">
                <img
                  ref={imageRef}
                  src={enhancedPreview || preview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              {/* Enhancement Filters */}
              <div className="mb-3">
                <label className="text-xs text-gray-600 font-medium block mb-2">Auto-Enhance</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resetPreview()}
                    className={`px-2 py-1 text-xs rounded transition ${
                      activeFilter === 'none'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEnhancementFilter('brighten')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      activeFilter === 'brighten'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Brighten
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEnhancementFilter('enhance')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      activeFilter === 'enhance'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Enhance
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEnhancementFilter('vivid')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      activeFilter === 'vivid'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Vivid
                  </button>
                </div>
              </div>

              {/* Face & Face Match Info */}
              {faceAnalysis && (
                <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2 rounded">
                  <p>Face count: <strong>{faceAnalysis.faceCount}</strong></p>
                  <p>Confidence: <strong>{(faceAnalysis.confidence * 100).toFixed(1)}%</strong></p>
                  {faceAnalysis.matchDistance != null && (
                    <>
                      <p>Match similarity: <strong>{(faceAnalysis.matchSimilarity * 100).toFixed(1)}%</strong></p>
                      <p>Threshold: <strong>{(faceAnalysis.matchThreshold * 100).toFixed(1)}%</strong></p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                id="override-validation"
                checked={allowOverride}
                onChange={(e) => setAllowOverride(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="override-validation" className="cursor-pointer">
                Ignore warnings and proceed (not recommended)
              </label>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || (validationErrors.length > 0 && !allowOverride)}
            className="w-full"
          >
            {submitting ? 'Submitting...' : 'Submit Photo'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResubmitPage;
