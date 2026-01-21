import React, { useState, useEffect } from 'react';

interface MicroQuote {
  text: string;
  author: string;
}

// Short quotes (60-70 chars max) for micro whisper above button
const MICRO_QUOTES: MicroQuote[] = [
  {
    text: "The best startups are discovered, not pitched.",
    author: "Andreessen"
  },
  {
    text: "The right investor matters more than the first.",
    author: "Fred Wilson"
  },
  {
    text: "Timing and position matter more than pitch decks.",
    author: "Hoffman"
  },
  {
    text: "Great investors recognize signals early.",
    author: "Naval"
  },
  {
    text: "Raise from people who already understand you.",
    author: "Altman"
  }
];

export const MicroQuoteWhisper: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % MICRO_QUOTES.length);
        setIsVisible(true);
      }, 400);
      
    }, 14000); // Rotate every 14 seconds (slow)

    return () => clearInterval(interval);
  }, [isPaused]);

  const currentQuote = MICRO_QUOTES[currentIndex];

  return (
    <div 
      className="absolute -top-6 right-0 transition-opacity duration-[400ms]"
      style={{ opacity: isVisible ? 0.65 : 0 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <p className="text-xs text-gray-400 italic text-right">
        "{currentQuote.text}" <span className="text-gray-500">— {currentQuote.author}</span>
      </p>
    </div>
  );
};
