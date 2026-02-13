import { Link } from 'react-router-dom';
import StartupUploader from '../components/StartupUploader';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-4 sm:p-8">
      {/* Navigation */}
      <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-50 w-full px-2 sm:px-0 sm:w-auto">
        <div className="flex gap-1 sm:gap-2 items-center justify-center flex-wrap">
          <Link to="/" className="text-4xl sm:text-6xl hover:scale-110 transition-transform">🍯</Link>
          <Link to="/" className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">🏠 Home</Link>
          <Link to="/vote" className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">🗳️ Vote</Link>
          <Link to="/investors" className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">💼 Investors</Link>
          <Link to="/upload" className="px-4 sm:px-6 py-1.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-full shadow-xl scale-105 sm:scale-110 text-xs sm:text-base whitespace-nowrap">🚀 Upload Startup</Link>
          <Link to="/portfolio" className="px-3 sm:px-4 py-1 sm:py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg text-xs sm:text-sm whitespace-nowrap">⭐ Portfolio</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pt-24 sm:pt-28">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-6xl sm:text-8xl mb-4">🚀</div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-2 sm:mb-4">
            Submit Your Startup
          </h1>
          <p className="text-lg sm:text-2xl text-purple-200">
            Get your company in front of top investors
          </p>
        </div>

        {/* Uploader Component */}
        <StartupUploader />
      </div>
    </div>
  );
}
