import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Minimal back button */}
      <div className="fixed top-6 left-6 z-50">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-24 pb-20">
        {/* Title - understated */}
        <h1 className="text-3xl font-bold text-white mb-2">
          Why Pyth Exists
        </h1>
        <p className="text-sm text-gray-600 mb-16 font-mono">
          For those who already believe
        </p>

        {/* Origin Story - The Myth */}
        <div className="space-y-8 text-gray-400 leading-relaxed">
          <p className="text-lg text-gray-300">
            <span className="text-white">Venture capital has always been about pattern recognition — informed by experience, intuition, and hindsight.</span>
          </p>
          
          <p>
            Great investors point to their wins. They've earned that confidence.
          </p>
          
          <p>
            But for every breakout success, there are dozens of strong founders who were passed on — not because they lacked merit, 
            but because the signals weren't visible at that moment.
          </p>
          
          <p>
            <span className="text-amber-500">The most important patterns rarely live in pitch decks or warm intros.</span>
          </p>
          
          <p>
            They emerge across data.
          </p>
          
          <div className="my-10 py-6 border-l-2 border-amber-500/50 pl-6">
            <p className="text-xl text-white mb-4">Success has signatures.</p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>• Team velocity</p>
              <p>• Market timing</p>
              <p>• Capital efficiency signals</p>
              <p>• Thesis convergence with active investors</p>
            </div>
          </div>
          
          <p>
            We built Pythh to read these signatures — not to replace human judgment, but to extend it. 
            To surface alignment earlier. To reduce missed opportunities on both sides of the table.
          </p>
          
          <p>
            The name comes from the Greek word for inquiry — a system designed to ask better questions 
            about who's truly ready to invest and who's ready to be invested in.
          </p>
          
          <div className="my-10 py-6 border-l-2 border-gray-700 pl-6">
            <p className="text-gray-500 italic">
              Not prediction. Pattern recognition.
            </p>
          </div>
          
          <p>
            Every startup that enters Pyth is evaluated by the <span className="text-amber-500">GOD Algorithm</span> — our proprietary system 
            that weighs hundreds of signals against a single question:
          </p>
          
          <p className="text-white text-lg">
            Which investors are actually positioned to say yes — right now.
          </p>
          
          <p>
            We don't promise funding.
          </p>
          
          <p>
            We promise clarity — before founders spend months chasing the wrong conversations, 
            and before investors miss companies that already match their thesis.
          </p>
        </div>
        
        {/* Minimal CTA */}
        <div className="mt-20 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-amber-500 transition-colors font-mono"
          >
            Enter your startup →
          </Link>
        </div>
      </div>
    </div>
  );
}
