/**
 * READING SIGNALS LOADER
 * ======================
 * The minimal, observational loading state.
 * "Reading investor signals…" - frames system as observational, not computational.
 */

import { useEffect, useState } from 'react';

interface ReadingSignalsLoaderProps {
  onComplete?: () => void;
  minDuration?: number; // Minimum time to show loader (ms)
}

export default function ReadingSignalsLoader({ 
  onComplete,
  minDuration = 2500 
}: ReadingSignalsLoaderProps) {
  const [opacity, setOpacity] = useState(0);
  const [dots, setDots] = useState('');

  // Fade in
  useEffect(() => {
    const timer = setTimeout(() => setOpacity(1), 100);
    return () => clearTimeout(timer);
  }, []);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Auto-complete after minimum duration
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, minDuration);
      return () => clearTimeout(timer);
    }
  }, [onComplete, minDuration]);

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center transition-opacity duration-500"
      style={{ opacity }}
    >
      <p className="text-gray-400 text-lg font-light tracking-wide">
        Reading investor signals<span className="inline-block w-8">{dots}</span>
      </p>
    </div>
  );
}
