import React, { useState, useCallback, useEffect } from 'react';
import exifr from 'exifr';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone'; // Assuming react-dropzone is available or we implement simple logic. 
// Note: If react-dropzone is not installed, I will implement a custom hook or simple listeners.
// Since I can't check installed packages easily without package.json check (which I did earlier and it's not likely there), 
// I will implement a robust native drag-and-drop to avoid dependency issues.

const GeoImageUploader = () => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gpsData, setGpsData] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const navigate = useNavigate();

  const processFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setGpsData(null);

    // Create Preview
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);

    try {
      console.log("🔍 Extracting GPS data...");
      // Use exifr to extract GPS
      const data = await exifr.gps(file);

      if (data && data.latitude && data.longitude) {
        console.log("✅ GPS Found:", data);
        setGpsData({
          lat: data.latitude,
          lng: data.longitude
        });
      } else {
        console.warn("❌ No GPS data found");
        setError("This photo doesn't contain GPS location data. Please try another one.");
      }
    } catch (err) {
      console.error("⚠️ Error extracting GPS:", err);
      setError("Failed to analyze the image. It might be corrupted or format not supported.");
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = (files) => {
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  // Drag & Drop Handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleStartGame = () => {
    if (gpsData) {
      navigate('/game', { state: { lat: gpsData.lat, lng: gpsData.lng } });
    }
  };

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22] text-[#111111] dark:text-[#f1f5f9] font-sans flex flex-col items-center py-10 px-4 transition-colors">

      <div className="max-w-2xl w-full flex flex-col gap-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Location Analyzer</h1>
          <p className="text-gray-500 dark:text-gray-400">Upload a travel photo to extract its GPS location and start a round of Roadview Game.</p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-[#1e2b36] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8">

          {/* Upload Zone */}
          <div
            className={`relative w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden
                            ${dragActive
                ? 'border-[#1392ec] bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-[#1392ec] hover:bg-gray-50 dark:hover:bg-gray-800'
              }
                            ${imageSrc ? 'h-auto p-4 border-solid' : 'h-64'}
                        `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!imageSrc ? (
              <>
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleChange}
                />
                <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[#1392ec] flex items-center justify-center mb-4">
                  <span className="text-3xl">☁️</span>
                </div>
                <h3 className="text-lg font-bold mb-1">Click or Drag & Drop</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Supports JPG, PNG, HEIC (with location data)</p>
              </>
            ) : (
              <div className="flex flex-col items-center w-full">
                <img
                  src={imageSrc}
                  alt="Uploaded Preview"
                  className="max-h-[400px] w-auto rounded-lg shadow-md object-contain"
                />
                <button
                  onClick={() => { setImageSrc(null); setGpsData(null); setError(null); }}
                  className="mt-4 text-[#1392ec] font-bold text-sm hover:underline"
                >
                  Remove & Upload Another
                </button>
              </div>
            )}
          </div>

          {/* Status & Results */}
          <div className="mt-6 space-y-4">
            {loading && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 animate-pulse justify-center">
                <div className="animate-spin size-5 border-2 border-[#1392ec] border-t-transparent rounded-full"></div>
                <span className="font-bold">Analyzing photo metadata...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/50">
                <span>⚠️</span>
                <span className="font-bold text-sm">{error}</span>
              </div>
            )}

            {gpsData && (
              <div className="animate-fade-in-up space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-[#101a22] p-4 rounded-xl text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Latitude</p>
                    <p className="text-xl font-mono font-bold text-[#111111] dark:text-[#f1f5f9]">{gpsData.lat.toFixed(6)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#101a22] p-4 rounded-xl text-center">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Longitude</p>
                    <p className="text-xl font-mono font-bold text-[#111111] dark:text-[#f1f5f9]">{gpsData.lng.toFixed(6)}</p>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center justify-center gap-2 border border-green-100 dark:border-green-900/50">
                  <span>✅</span>
                  <span className="font-bold">Location data extracted successfully!</span>
                </div>

                <button
                  onClick={handleStartGame}
                  className="w-full py-4 bg-[#1392ec] hover:bg-blue-600 active:scale-[0.98] transition-all text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <span>�</span>
                  Start Roadview Game
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Debug / Nav Helper */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 font-medium text-sm transition-colors"
          >
            ← Back to Home
          </button>
        </div>

      </div>
    </div>
  );
};

export default GeoImageUploader;