import React, { useState, useEffect } from 'react';

interface Quote {
  text: string;
  author: string;
}

// 🔒 FINAL ROTATION SET - Launch edition
const QUOTES: Quote[] = [
  {
    text: "The best startups are discovered, not pitched.",
    author: "MARC ANDREESSEN"
  },
  {
    text: "The most successful founders don't chase investors. They become visible to them.",
    author: "PAUL GRAHAM"
  },
  {
    text: "Great investors recognize signals before the story is obvious.",
    author: "NAVAL RAVIKANT"
  },
  {
    text: "Timing and position matter more than pitch decks.",
    author: "REID HOFFMAN"
  },
  {
    text: "The best founders raise from people who already understand them.",
    author: "SAM ALTMAN"
  }
];

export const IntellectualAuthoritySection: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % QUOTES.length);
        setIsVisible(true);
      }, 400); // Fade out duration
      
    }, 9000); // Rotate every 9 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

  const currentQuote = QUOTES[currentIndex];

  return (
    <div className="w-full">
      {/* Quote Strip - Compact sidecar, one line max, locked height */}
      <div 
        className="relative min-h-[60px] flex items-start"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div 
          className={`transition-opacity duration-[400ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Quote Text - Very compact, 1-2 lines max */}
          <blockquote className="text-sm text-gray-400 font-light italic leading-snug mb-1.5 line-clamp-2">
            "{currentQuote.text}"
          </blockquote>
          
          {/* Author - Small, very muted */}
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-mono">
            — {currentQuote.author}
          </p>
        </div>
      </div>
    </div>
  );
};
