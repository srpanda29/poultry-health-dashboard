// index.js - Compiled JavaScript for Poultry Health Dashboard

// React and ReactDOM are loaded from CDN in index.html
const { useState, useEffect, useRef } = React;
const { Thermometer, Droplets, CloudFog, UploadCloud, Camera, CheckCircle, XCircle, Play, Pause, Maximize, Minimize } = LucideReact; // LucideReact is globally available from CDN

// Main App component for the Poultry Health Dashboard
const App = () => {
  // State for disease detection
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [detectionResult, setDetectionResult] = useState('');
  const [rawApiResponse, setRawApiResponse] = useState(''); // For debugging
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // States for Live Sensor Data
  const [temperature, setTemperature] = useState('N/A');
  const [humidity, setHumidity] = useState('N/A');
  const [ammonia, setAmmonia] = useState('N/A');

  // States for Webcam
  const videoRef = useRef(null); // Reference to the video element
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState('');

  // State for Fullscreen
  const appRef = useRef(null); // Reference to the main app div for fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Roboflow API details (These are from your Roboflow account and workflow)
  const ROBOTFLOW_API_KEY = "77URwEVgvgWzOu2ft6CF";
  const ROBOTFLOW_WORKFLOW_ENDPOINT = "https://serverless.roboflow.com/infer/workflows/poultrydetection-ptwgp/detect-and-classify-2";

  // Simulate live sensor data updates
  useEffect(() => {
    const fetchSensorData = () => {
      // --- Placeholder for fetching real sensor data from Raspberry Pi ---
      // In a real application, this would fetch data from your Raspberry Pi backend.
      // Example:
      /*
      fetch('http://YOUR_RASPBERRY_PI_IP:5000/sensor_data')
        .then(response => response.json())
        .then(data => {
          setTemperature(data.temperature);
          setHumidity(data.humidity);
          setAmmonia(data.ammonia);
        })
        .catch(error => console.error('Error fetching sensor data:', error));
      */

      // Simulated data for demonstration
      setTemperature(`${(Math.random() * (30 - 20) + 20).toFixed(1)}°C`); // 20.0-30.0 °C
      setHumidity(`${(Math.random() * (70 - 40) + 40).toFixed(1)}%`);    // 40.0-70.0 %
      setAmmonia(`${(Math.random() * (20 - 5) + 5).toFixed(1)} ppm`);    // 5.0-20.0 ppm
    };

    fetchSensorData();
    const interval = setInterval(fetchSensorData, 5000); // Update every 5 seconds
    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  // Effect to handle webcam stream
  useEffect(() => {
    if (webcamActive) {
      // Request access to the user's webcam
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => {
          console.error("Error accessing webcam:", err);
          setWebcamError("Cannot access webcam. Please ensure it's connected and permissions are granted.");
          setWebcamActive(false); // Turn off active state if there's an error
        });
    } else {
      // Stop the webcam stream when webcamActive is false
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    // Cleanup function: stop stream when component unmounts or webcamActive changes to false
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [webcamActive]); // Re-run this effect when webcamActive state changes

  // Toggle webcam on/off
  const toggleWebcam = () => {
    setWebcamActive(prev => !prev);
    setWebcamError(''); // Clear previous webcam errors on toggle
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (appRef.current) {
      if (!document.fullscreenElement) {
        // If not in fullscreen, request fullscreen
        appRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name}). This is often disallowed by browser security policies, especially when running in an embedded environment (like Canvas) or without direct user interaction. Try manually using F11 (or browser's full-screen option) or deploy the app to a live server.`);
          // Removed setErrorMessage here to prevent displaying on UI, as it's a console-only message now.
        });
      } else {
        // If in fullscreen, exit fullscreen
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => {
          console.error(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
          // Removed setErrorMessage here to prevent displaying on UI
        });
      }
    }
  };

  // Listen for fullscreen change events (e.g., user presses F11)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * Handles the image file selection from the input.
   * Updates the selectedImage state and generates a preview URL.
   * @param {Object} event - The change event from the file input.
   * @returns {void}
   */
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setDetectionResult('');
      setRawApiResponse('');
      setErrorMessage('');
    } else {
      setSelectedImage(null);
      setImagePreviewUrl('');
      setDetectionResult('');
      setRawApiResponse('');
      setErrorMessage('');
    }
  };

  /**
   * Converts a File object to a Base64 string.
   * This is often required by ML APIs for image submission.
   * @param {File} file - The image file to convert.
   * @returns {Promise<string>} A promise that resolves with the base64 string.
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  /**
   * Handles the disease detection process by sending the image to Roboflow.
   * @returns {Promise<void>}
   */
  const handleDetectDisease = async () => {
    if (!selectedImage) {
      setErrorMessage('Please select an image first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setDetectionResult('');
    setRawApiResponse('');

    try {
      const base64Image = await fileToBase64(selectedImage);
      const requestBody = {
        api_key: ROBOTFLOW_API_KEY,
        inputs: {
          image: {
            type: "base64",
            value: base64Image
          }
        }
      };

      console.log("Attempting API call to:", ROBOTFLOW_WORKFLOW_ENDPOINT);
      const response = await fetch(ROBOTFLOW_WORKFLOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        try { setRawApiResponse(JSON.stringify(JSON.parse(errorText), null, 2)); } catch (e) { setRawApiResponse(errorText); }
        if (response.status === 401) { throw new Error(`API error: 401 Unauthorized. Check API key/workflow access.`); }
        else if (response.status === 403) { throw new Error(`API error: 403 Forbidden. Insufficient permissions/workflow not public.`); }
        else if (response.status === 422) { throw new Error(`API error: 422 Unprocessable Entity. Request body structure incorrect.`); }
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Roboflow API Response:", data);
      setRawApiResponse(JSON.stringify(data, null, 2));

      let foundPrediction = false;
      if (data.outputs && Array.isArray(data.outputs)) {
        for (const output of data.outputs) {
          if (output.model_predictions && output.model_predictions.predictions && Array.isArray(output.model_predictions.predictions) && output.model_predictions.predictions.length > 0) {
            const topPrediction = output.model_predictions.predictions[0];
            if (topPrediction.class && typeof topPrediction.confidence === 'number' && topPrediction.class.toLowerCase() !== 'chicken') {
              const predictedClass = topPrediction.class;
              const confidence = (topPrediction.confidence * 100).toFixed(2);
              setDetectionResult(`Detected: ${predictedClass} (Confidence: ${confidence}%)`);
              foundPrediction = true;
              break;
            }
          }
        }
      }

      if (!foundPrediction) {
        setDetectionResult('No clear disease classification prediction found. The model might not have detected a known disease or output structure is unexpected.');
      }

    } catch (error) {
      console.error('Error detecting disease:', error);
      setErrorMessage(`Failed to detect disease: ${error.message}.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render function for the App component
  return (
    <div ref={appRef} className="min-h-screen bg-gradient-to-br from-purple-900 to-gray-900 font-inter text-gray-200 antialiased"> {/* Main background is deep purple to dark gray gradient */}
      {/* Custom CSS for text gradient */}
      <style>{`
        .text-gradient {
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          background-image: linear-gradient(to right, #a78bfa, #818cf8, #3b82f6); /* Purple, Indigo, Blue */
        }
      `}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-gray-900 shadow-2xl py-8 px-4 md:px-8 text-white relative"> {/* Header is dark blue to dark gray gradient */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-center tracking-tight drop-shadow-lg">
          <span className="text-gradient">Poultry Health Dashboard</span> <span role="img" aria-label="chicken emoji">🐔</span> {/* Applied text gradient */}
        </h1>
        <p className="text-center text-gray-400 mt-3 text-lg md:text-xl font-light">Real-time monitoring and AI-powered disease detection for optimal poultry care.</p>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize size={24} className="text-gray-300" /> : <Maximize size={24} className="text-gray-300" />}
        </button>
      </header>

      <main className="w-full px-4 md:px-8 lg:px-12 py-4 md:py-8 lg:py-12"> {/* Adjusted for full width and padding */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Live Data Section */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 border border-gray-700 transition-all duration-300 hover:shadow-3xl transform hover:-translate-y-1 custom-shadow">
            <h2 className="text-2xl font-semibold text-gray-100 mb-6 flex items-center border-b pb-4 border-gray-700">
              <Thermometer size={24} className="mr-3 text-blue-400" /> Live Environment Data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="p-5 bg-gray-700 rounded-lg shadow-lg border border-gray-600 flex flex-col items-center justify-center transition-all duration-200 hover:bg-gray-600 custom-shadow-sm">
                <Droplets size={32} className="text-blue-300 mb-2" />
                <p className="text-md font-medium text-blue-200 mb-1">Temperature</p>
                <p className="text-4xl font-extrabold text-blue-100">{temperature}</p>
              </div>
              <div className="p-5 bg-gray-700 rounded-lg shadow-lg border border-gray-600 flex flex-col items-center justify-center transition-all duration-200 hover:bg-gray-600 custom-shadow-sm">
                <Droplets size={32} className="text-green-300 mb-2" />
                <p className="text-md font-medium text-green-200 mb-1">Humidity</p>
                <p className="text-4xl font-extrabold text-green-100">{humidity}</p>
              </div>
              <div className="p-5 bg-gray-700 rounded-lg shadow-lg border border-gray-600 flex flex-col items-center justify-center transition-all duration-200 hover:bg-gray-600 custom-shadow-sm">
                <CloudFog size={32} className="text-yellow-300 mb-2" />
                <p className="text-md font-medium text-yellow-200 mb-1">Ammonia</p>
                <p className="text-4xl font-extrabold text-yellow-100">{ammonia}</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center mt-6">
              (Data is simulated. Real-time data requires Raspberry Pi backend integration.)
            </p>
          </div>

          {/* Live Webcam Section */}
          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 border border-gray-700 transition-all duration-300 hover:shadow-3xl transform hover:-translate-y-1 custom-shadow">
            <h2 className="text-2xl font-semibold text-gray-100 mb-6 flex items-center border-b pb-4 border-gray-700 w-full">
              <Camera size={24} className="mr-3 text-purple-400" /> Live Webcam Feed
            </h2>
            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-inner border-2 border-gray-700">
              {/* Video element for live stream */}
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
              {!webcamActive && !webcamError && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-bold text-lg bg-black bg-opacity-60">
                  Click 'Start Webcam' to view feed
                </div>
              )}
              {webcamError && (
                <div className="absolute inset-0 flex items-center justify-center text-red-400 font-bold text-lg bg-black bg-opacity-70 p-4 text-center">
                  {webcamError}
                </div>
              )}
            </div>
            <button
              onClick={toggleWebcam}
              className={`mt-4 py-2 px-5 rounded-lg text-white font-semibold text-md transition-all duration-300 ease-in-out
                ${webcamActive
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
                } focus:outline-none focus:ring-4 shadow-md hover:shadow-lg flex items-center justify-center`}
            >
              {webcamActive ? <><Pause size={20} className="mr-2" /> Stop Webcam</> : <><Play size={20} className="mr-2" /> Start Webcam</>}
            </button>
          </div>
        </div>

        {/* Disease Detection Section */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 border border-gray-700 transition-all duration-300 hover:shadow-3xl transform hover:-translate-y-1 custom-shadow">
            <h2 className="text-2xl font-semibold text-gray-100 mb-6 flex items-center border-b pb-4 border-gray-700">
            <UploadCloud size={24} className="mr-3 text-orange-400" /> Disease Detection from Image
          </h2>
          <label htmlFor="image-upload" className="block text-md font-medium text-gray-300 mb-4">
            Upload Chicken Image:
          </label>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-100 border border-gray-600 rounded-lg cursor-pointer bg-gray-700 py-2 px-3 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
          />

          {imagePreviewUrl && (
            <div className="mt-8 p-6 bg-gray-700 rounded-lg shadow-inner flex flex-col items-center border border-gray-600">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">Image Preview:</h3>
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="max-w-full h-auto rounded-lg shadow-md border border-gray-500 object-contain max-h96"
                onLoad={() => URL.revokeObjectURL(imagePreviewUrl)}
              />
            </div>
          )}

          <button
            onClick={handleDetectDisease}
            disabled={isLoading || !selectedImage}
            className={`w-full py-3 px-6 rounded-lg text-white font-semibold text-lg transition-all duration-300 ease-in-out mt-8
              ${isLoading || !selectedImage
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 active:bg-blue-800 shadow-lg hover:shadow-xl transform hover:scale-[1.01]'
              } flex items-center justify-center`}
            >
              Detecting...
            </>
          ) : (
            'Detect Disease'
          )}
        </button>

          {errorMessage && (
            <div className="mt-8 p-4 bg-red-800 text-red-100 rounded-lg text-center border border-red-700 shadow-md flex items-center justify-center">
              <XCircle size={20} className="mr-2" /> <p className="font-medium">{errorMessage}</p>
            </div>
          )}

          {detectionResult && (
            <div className="mt-8 p-4 bg-green-800 text-green-100 rounded-lg text-center border border-green-700 shadow-md flex items-center justify-center">
              <CheckCircle size={20} className="mr-2" /> <p className="font-medium">{detectionResult}</p>
            </div>
          )}

          {rawApiResponse && (
            <div className="mt-8 p-4 bg-gray-900 text-gray-300 rounded-lg overflow-x-auto border border-gray-700 shadow-md">
              <h3 className="text-md font-semibold text-gray-200 mb-2">Raw API Response (for debugging):</h3>
              <pre className="text-sm whitespace-pre-wrap break-words font-mono bg-gray-800 p-3 rounded-md border border-gray-700">{rawApiResponse}</pre>
            </div>
          )}
        </div> {/* End Disease Detection Section */}

        <footer className="text-center text-gray-400 text-sm mt-12 py-6 border-t border-gray-700">
          <p>&copy; {new Date().getFullYear()} Poultry Health Dashboard. All rights reserved.</p>
          <p className="mt-1">Built with <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">React</a> and <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Tailwind CSS</a>.</p>
          <p className="mt-1">Live data and video streams require a Raspberry Pi backend.</p>
        </footer>
      </main>
    </div>
  );
};

// Render the App component into the HTML
ReactDOM.render(
  React.createElement(React.StrictMode, null, React.createElement(App, null)),
  document.getElementById('root')
);