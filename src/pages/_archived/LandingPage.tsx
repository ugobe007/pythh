import React, { Suspense } from 'react';
import MatchingEngine from '../components/MatchingEngine';

const LandingPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-400 mb-4"></div>
          <div className="text-white text-2xl font-bold">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400 bg-clip-text text-transparent">Loading pythh.ai...</span>
          </div>
        </div>
      </div>
    }>
      <MatchingEngine />
    </Suspense>
  );
};

export default LandingPage;
