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
  }
};

// Render function for the App component
const App = () => {
  // ... (all the states and functions defined above)
  // ... (the return statement with JSX)
}

// This part renders the App component into the HTML
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// Make App globally accessible for the script to find it
window.App = App;