import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

function Assistant() {
  const [pdfFile, setPdfFile] = useState(null);
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef(null);
  const [speechQueue, setSpeechQueue] = useState([]);
  const [currentChunk, setCurrentChunk] = useState(0);

  // Function to split large text into smaller chunks for speech synthesis
  const splitTextForSpeech = (text) => {
    const maxLength = 200; // Set a character limit for each chunk (adjust as needed)
    const chunks = [];

    let startIndex = 0;
    while (startIndex < text.length) {
      let endIndex = startIndex + maxLength;

      // Ensure we don't cut off in the middle of a word
      if (endIndex < text.length) {
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex) {
          endIndex = lastSpace;
        }
      }

      const chunk = text.slice(startIndex, endIndex);
      chunks.push(chunk);
      startIndex = endIndex;
    }

    return chunks;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    setPdfFile(file);
    setText('');
    setSummary('');
    setError(null);

    if (file) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function () {
          let result = reader.result;
          const pdf = await pdfjsLib.getDocument({ url: result }).promise;
          let extractedText = '';

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            extractedText += pageText + '\n';
          }

          setText(extractedText);
        };
      } catch (err) {
        setError('Error extracting text from PDF.');
      }
    }
  };

  const handleSummarize = async () => {
    if (!text) {
      setError('No text extracted from PDF.');
      return;
    }

    setLoading(true);
    setError(null);
    setSummary('');

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/summarize_text',
        { text: text },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const resultSummary = response.data.summary;
      setSummary(resultSummary);

      const chunks = splitTextForSpeech(resultSummary); // Split summary into smaller chunks
      setSpeechQueue(chunks);
      setCurrentChunk(0); // Start at the first chunk

      utteranceRef.current = new SpeechSynthesisUtterance(chunks[0]);

      speechSynthesis.speak(utteranceRef.current);
      setIsPlaying(true);

      utteranceRef.current.onend = handleSpeechEnd;

    } catch (err) {
      if (err.response) {
        setError(err.response.data.detail || 'An error occurred while summarizing.');
      } else if (err.request) {
        setError('No response from the server. Please ensure the backend is running.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpeechEnd = () => {
    // Continue reading the next chunk if available
    if (currentChunk < speechQueue.length - 1) {
      setCurrentChunk((prevChunk) => prevChunk + 1);
      const nextChunk = speechQueue[currentChunk + 1];
      utteranceRef.current = new SpeechSynthesisUtterance(nextChunk);
      speechSynthesis.speak(utteranceRef.current);
      utteranceRef.current.onend = handleSpeechEnd; // Continue listening for end of each chunk
    } else {
      setIsPlaying(false); // Finished reading all chunks
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      speechSynthesis.resume();
      setIsPlaying(true);
    }
  };

  const handleStartOver = () => {
    // Stop current speech and restart from the beginning
    speechSynthesis.cancel();
    setCurrentChunk(0);
    if (speechQueue.length > 0) {
      utteranceRef.current = new SpeechSynthesisUtterance(speechQueue[0]);
      speechSynthesis.speak(utteranceRef.current);
      utteranceRef.current.onend = handleSpeechEnd;
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Reset all states
    setPdfFile(null);
    setText('');
    setSummary('');
    setLoading(false);
    setError(null);
    setIsPlaying(false);
    setSpeechQueue([]);
    setCurrentChunk(0);
    utteranceRef.current = null;

    // Reset the file input value
    document.getElementById('pdf-upload-input').value = null;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-4 text-center">PDF Summarizer</h1>

        <div className="space-y-4">
          {/* Reset and Upload Section */}
          <div className="flex items-center space-x-4">
            
            <div className="flex-grow">
              <label className="block text-gray-700">Upload PDF:</label>
              <input
                id="pdf-upload-input"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-full file:border-0
                           file:text-sm file:font-semibold
                           file:bg-blue-50 file:text-blue-700
                           hover:file:bg-blue-100"
              />
            </div>
            <button
              onClick={handleReset}
              className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition flex-shrink-0"
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSummarize}
            className={`w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? 'Summarizing...' : 'Summarize Text'}
          </button>

          {summary && (
            <div className="mt-6 relative">
              <h2 className="text-xl font-semibold mb-2">Summary:</h2>
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap">{summary}</p>
              </div>
              
              {/* Play/Pause Icon */}
              <div className="absolute bottom-2 right-2">
                <button onClick={togglePlayPause} className="text-blue-500 hover:text-blue-700 transition">
                  {isPlaying ? (
                    <FontAwesomeIcon icon={faPause} size="2x" />
                  ) : (
                    <FontAwesomeIcon icon={faPlay} size="2x" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Assistant;
