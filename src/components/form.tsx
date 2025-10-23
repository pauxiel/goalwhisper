"use client";

import { useState } from "react";

interface FormProps {
  url: string;
}

export default function Form({ url }: FormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [videoId, setVideoId] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadComplete(false);
      setAnalysisResults(null);
      setAnalysisStatus("");
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
    setUploadComplete(false);
    setAnalysisResults(null);
    setAnalysisStatus("");
  };

  const downloadVideoFromUrl = async (url: string): Promise<File> => {
    if (isYouTubeUrl(url)) {
      // For YouTube URLs, we'll need a server-side endpoint to handle this
      // due to CORS restrictions and complexity of YouTube extraction
      const response = await fetch('/api/download-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download YouTube video: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const videoId = extractYouTubeVideoId(url);
      return new File([blob], `youtube-${videoId}.mp4`, { type: 'video/mp4' });
    } else {
      // Direct video file URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const fileName = url.split('/').pop()?.split('?')[0] || 'video.mp4';
      return new File([blob], fileName, { type: 'video/mp4' });
    }
  };

  const isYouTubeUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('youtube.com') || 
             urlObj.hostname.includes('youtu.be') ||
             urlObj.hostname.includes('youtube-nocookie.com');
    } catch {
      return false;
    }
  };

  const extractYouTubeVideoId = (url: string): string => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : 'unknown';
  };

  const handleUpload = async () => {
    if (uploadMethod === "file" && !file) return;
    if (uploadMethod === "url" && !videoUrl) return;

    setUploading(true);
    try {
      let fileToUpload = file;
      let generatedVideoId = "";

      if (uploadMethod === "url") {
        // Download video from URL
        fileToUpload = await downloadVideoFromUrl(videoUrl);
        generatedVideoId = videoUrl.split('/').pop()?.split('?')[0]?.replace(/\.[^/.]+$/, "")?.replace(/[^a-zA-Z0-9]/g, '-') || 'video-from-url';
      } else {
        generatedVideoId = file!.name.replace('.mp4', '').replace(/[^a-zA-Z0-9]/g, '-');
      }

      const response = await fetch(url, {
        method: "PUT",
        body: fileToUpload,
        headers: {
          "Content-Type": fileToUpload!.type,
        },
      });

      if (response.ok) {
        setUploadComplete(true);
        setVideoId(generatedVideoId);
        setAnalysisStatus("processing");
        console.log("Video uploaded successfully!");
        
        // Start polling for analysis results
        startPollingForAnalysis(generatedVideoId);
      } else {
        console.error("Upload failed:", response.statusText);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const startPollingForAnalysis = (videoId: string) => {
    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/analysis/${videoId}`);
        const data = await response.json();

        if (response.ok) {
          setAnalysisStatus(data.status);
          
          if (data.status === "completed" && data.analysisResults) {
            setAnalysisResults(data.analysisResults);
            setPolling(false);
            clearInterval(pollInterval);
          } else if (data.status === "failed") {
            setAnalysisStatus("failed");
            setPolling(false);
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error("Error polling for analysis:", error);
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setPolling(false);
    }, 600000);
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isValidVideoUrl = (url: string) => {
    try {
      new URL(url);
      // Accept YouTube URLs or direct video file URLs
      return isYouTubeUrl(url) || url.match(/\.(mp4|avi|mov|wmv|flv|webm)(\?.*)?$/i) !== null;
    } catch {
      return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Soccer Video Analysis</h2>
      
      {/* Upload Method Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose upload method:
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="file"
              checked={uploadMethod === "file"}
              onChange={(e) => setUploadMethod(e.target.value as "file")}
              className="mr-2"
            />
            Upload File
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="url"
              checked={uploadMethod === "url"}
              onChange={(e) => setUploadMethod(e.target.value as "url")}
              className="mr-2"
            />
            Video URL
          </label>
        </div>
      </div>

      {/* File Upload */}
      {uploadMethod === "file" && (
        <div className="mb-4">
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
            Choose a soccer video file:
          </label>
          <input
            id="file"
            type="file"
            accept="video/mp4"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>
      )}

      {/* URL Input */}
      {uploadMethod === "url" && (
        <div className="mb-4">
          <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-2">
            Enter video URL (YouTube, YouTube Shorts, or direct video files):
          </label>
          <input
            id="videoUrl"
            type="url"
            value={videoUrl}
            onChange={handleUrlChange}
            placeholder="https://youtube.com/watch?v=... or https://youtu.be/... or https://example.com/video.mp4"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {videoUrl && !isValidVideoUrl(videoUrl) && (
            <div className="mt-1 text-sm text-red-600">
              Please enter a valid video URL ending with .mp4, .avi, .mov, etc.
            </div>
          )}
          {videoUrl && isValidVideoUrl(videoUrl) && (
            <div className="mt-1 text-sm text-green-600">
              ✓ Valid video URL detected
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={
          uploading || 
          (uploadMethod === "file" && !file) || 
          (uploadMethod === "url" && (!videoUrl || !isValidVideoUrl(videoUrl)))
        }
        className="w-full bg-blue-500 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded transition-colors mb-4"
      >
        {uploading ? "Processing..." : "Upload & Analyze Video"}
      </button>

      {/* Upload Method Info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
        <h4 className="font-semibold mb-1">Supported Sources:</h4>
        <ul className="text-gray-700 space-y-1">
          <li>• <strong>File Upload:</strong> MP4 files from your device</li>
          <li>• <strong>YouTube:</strong> YouTube videos & YouTube Shorts URLs</li>
          <li>• <strong>Direct URLs:</strong> Direct links to video files (MP4, AVI, MOV, etc.)</li>
          <li>• <strong>Recommended:</strong> 2-15 minute soccer videos for best results</li>
        </ul>
      </div>

      {uploadComplete && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          ✅ Video uploaded successfully! Analysis started...
        </div>
      )}

      {analysisStatus && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Analysis Status</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Status: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              analysisStatus === "completed" ? "bg-green-100 text-green-800" :
              analysisStatus === "failed" ? "bg-red-100 text-red-800" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {analysisStatus}
            </span>
            {polling && (
              <span className="text-sm text-gray-500 animate-pulse">
                Checking for updates...
              </span>
            )}
          </div>
        </div>
      )}

      {analysisResults && (
        <div className="mt-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">📊 Analysis Summary</h3>
            <p className="text-gray-700">{analysisResults.summary}</p>
          </div>

          {analysisResults.keyMoments && analysisResults.keyMoments.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">⭐ Key Moments</h3>
              <div className="space-y-2">
                {analysisResults.keyMoments.map((moment: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                    <span className="font-medium">{formatTimestamp(moment.timestamp)}</span>
                    <span className="text-gray-600">{moment.description}</span>
                    <span className="text-sm text-blue-600">{moment.confidence.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisResults.activities && analysisResults.activities.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🏃‍♂️ Detected Activities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysisResults.activities.map((activity: any, index: number) => (
                  <div key={index} className="p-3 bg-white rounded shadow-sm">
                    <div className="font-medium">{activity.label}</div>
                    <div className="text-sm text-gray-600">
                      {activity.instances.length} instances • {activity.confidence.toFixed(1)}% confidence
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisResults.players && analysisResults.players.length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">👥 Player Tracking</h3>
              <div className="text-gray-700">
                Detected {analysisResults.players.length} unique players with tracking data
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {analysisResults.players.slice(0, 8).map((player: any, index: number) => (
                  <div key={index} className="p-2 bg-white rounded text-center text-sm">
                    Player {player.trackId}
                    <div className="text-xs text-gray-500">{player.appearances} frames</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisResults.scenes && analysisResults.scenes.length > 0 && (
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🎬 Scene Analysis</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {analysisResults.scenes.slice(0, 10).map((scene: any, index: number) => (
                  <div key={index} className="p-2 bg-white rounded shadow-sm">
                    <div className="font-medium">{formatTimestamp(scene.timestamp)}</div>
                    <div className="text-sm text-gray-600">{scene.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}