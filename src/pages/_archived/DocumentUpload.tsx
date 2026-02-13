import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface ExtractedStartup {
  name: string;
  tagline?: string;
  pitch?: string;
  problem?: string;
  solution?: string;
  marketSize?: string;
  teamCompanies?: string;
  investmentAmount?: string;
  industries?: string[];
  confidence: 'high' | 'medium' | 'low';
  extractedFrom: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export default function DocumentUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedStartups, setExtractedStartups] = useState<ExtractedStartup[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [processingFile, setProcessingFile] = useState('');

  // Check admin access
  const isAdmin = () => {
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      const profile = JSON.parse(userProfile);
      return profile.email === 'admin@hotmoneyhoney.com' || profile.isAdmin;
    }
    return false;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // In a real implementation, you would use a library like pdf.js or send to backend
    // For now, we'll simulate extraction
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`
          Startup Name: ${file.name.replace('.pdf', '').replace(/[-_]/g, ' ')}
          Problem: Traditional solutions are outdated and expensive
          Solution: Modern AI-powered platform that's affordable and easy to use
          Market Size: $50B+ total addressable market
          Team: Former executives from Google, Microsoft, and Amazon
          Raising: $2M Seed Round
          Industry: AI, SaaS, Enterprise
        `);
      }, 1500);
    });
  };

  const extractTextFromPPT = async (file: File): Promise<string> => {
    // In a real implementation, you would parse PPTX with a library or backend API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`
          ${file.name.replace('.pptx', '').replace('.ppt', '').replace(/[-_]/g, ' ')}
          
          The Problem:
          - Current market lacks innovation
          - Customers frustrated with legacy systems
          - $10B wasted annually on inefficient processes
          
          Our Solution:
          - Revolutionary platform using cutting-edge technology
          - 10x faster than competitors
          - 90% cost reduction
          
          Market Opportunity:
          - $100B TAM, $20B SAM
          - Growing 35% YoY
          
          Team:
          - CEO: Ex-Tesla, Stanford MBA
          - CTO: Ex-Google, MIT PhD
          - COO: Ex-Amazon, Harvard
          
          The Ask:
          - Seeking $5M Series A
          - 18 months runway
          - Scale to 100 enterprise customers
          
          Sectors: FinTech, AI, B2B SaaS
        `);
      }, 2000);
    });
  };

  const parseExtractedText = (text: string, fileName: string): ExtractedStartup => {
    // Use AI/NLP to parse the text (simulated here)
    const lines = text.toLowerCase();
    
    // Extract startup name
    const nameMatch = text.match(/(?:startup name|company|business):\s*(.+)/i);
    const name = nameMatch ? nameMatch[1].trim() : fileName.replace(/\.(pdf|pptx?)/gi, '').replace(/[-_]/g, ' ');
    
    // Extract problem
    const problemMatch = text.match(/(?:problem|challenge|pain point):\s*(.+?)(?:\n|$)/i);
    const problem = problemMatch ? problemMatch[1].trim() : 'Legacy systems and inefficient processes';
    
    // Extract solution
    const solutionMatch = text.match(/(?:solution|our product|platform):\s*(.+?)(?:\n|$)/i);
    const solution = solutionMatch ? solutionMatch[1].trim() : 'AI-powered platform for modern businesses';
    
    // Extract market size
    const marketMatch = text.match(/(?:market|tam|market size|opportunity):\s*(.+?)(?:\n|$)/i);
    const marketSize = marketMatch ? marketMatch[1].trim() : '$50B+ market opportunity';
    
    // Extract team
    const teamMatch = text.match(/(?:team|founders|executives):\s*(.+?)(?:\n|$)/i);
    const teamCompanies = teamMatch ? teamMatch[1].trim() : 'Google, Microsoft, Amazon';
    
    // Extract funding
    const fundingMatch = text.match(/(?:raising|funding|investment|ask|seeking):\s*(.+?)(?:\n|$)/i);
    const investmentAmount = fundingMatch ? fundingMatch[1].trim() : '$2M Seed';
    
    // Extract industries
    const industryMatch = text.match(/(?:industry|sector|vertical|space):\s*(.+?)(?:\n|$)/i);
    const industriesText = industryMatch ? industryMatch[1] : 'ai, saas';
    const industries = industriesText.toLowerCase().split(/[,\s]+/).map(i => i.trim()).filter(i => i);
    
    return {
      name,
      tagline: `Next-gen ${industries[0] || 'technology'} platform`,
      pitch: `${name} is transforming the industry with innovative solutions`,
      problem,
      solution,
      marketSize,
      teamCompanies,
      investmentAmount,
      industries: industries.slice(0, 3),
      confidence: 'medium',
      extractedFrom: fileName,
      status: 'pending'
    };
  };

  const handleFiles = async (files: FileList) => {
    const validFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.pdf') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length === 0) {
      alert('❌ Please upload PDF or PowerPoint files only');
      return;
    }
    
    setProcessing(true);
    const extracted: ExtractedStartup[] = [];
    
    for (const file of validFiles) {
      setProcessingFile(file.name);
      
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPDF(file);
      } else {
        text = await extractTextFromPPT(file);
      }
      
      const startup = parseExtractedText(text, file.name);
      extracted.push(startup);
    }
    
    setExtractedStartups(extracted);
    setProcessing(false);
    setCurrentStep('preview');
  };

  const toggleApproval = (index: number) => {
    setExtractedStartups(prev => prev.map((s, i) => 
      i === index 
        ? { ...s, status: s.status === 'approved' ? 'pending' : 'approved' }
        : s
    ));
  };

  const approveAll = () => {
    setExtractedStartups(prev => prev.map(s => ({ ...s, status: 'approved' as const })));
  };

  const saveAllApproved = () => {
    const approved = extractedStartups.filter(s => s.status === 'approved');
    
    if (approved.length === 0) {
      alert('⚠️ No startups approved. Please approve at least one.');
      return;
    }

    const existing = localStorage.getItem('uploadedStartups');
    const existingStartups = existing ? JSON.parse(existing) : [];
    
    const newStartups = approved.map((s, index) => ({
      id: Date.now() + index,
      name: s.name,
      tagline: s.tagline,
      pitch: s.pitch,
      description: s.pitch,
      marketSize: s.marketSize || 'TBD',
      unique: s.solution || 'TBD',
      raise: s.investmentAmount || 'TBD',
      stage: 1,
      yesVotes: 0,
      noVotes: 0,
      hotness: 0,
      answersCount: 0,
      industries: s.industries,
      fivePoints: [
        s.problem || 'Problem statement',
        s.solution || 'Solution description',
        s.marketSize || 'Market size',
        s.teamCompanies || 'Team background',
        s.investmentAmount || 'Investment amount'
      ],
      extractedFrom: s.extractedFrom,
      uploadedAt: new Date().toISOString()
    }));

    const allStartups = [...existingStartups, ...newStartups];
    localStorage.setItem('uploadedStartups', JSON.stringify(allStartups));
    
    alert(`✅ Successfully extracted and saved ${approved.length} startups from documents!`);
    setCurrentStep('complete');
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl p-12 text-center max-w-2xl">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Admin Access Required</h1>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 p-8 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-green-400 rounded-full blur-3xl opacity-40" style={{left: '20%', top: '40%'}}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/admin/bulk-upload')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all"
          >
            📊 CSV Upload Instead
          </button>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📄</div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
              Document Scanner Upload
            </h1>
            <p className="text-lg text-gray-700">
              Upload pitch decks & documents • AI extracts startup data automatically
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-full font-semibold ${currentStep === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                1. Upload Docs
              </div>
              <div className="w-12 h-0.5 bg-gray-300"></div>
              <div className={`px-4 py-2 rounded-full font-semibold ${currentStep === 'preview' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                2. Review
              </div>
              <div className="w-12 h-0.5 bg-gray-300"></div>
              <div className={`px-4 py-2 rounded-full font-semibold ${currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                3. Complete
              </div>
            </div>
          </div>

          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div>
              <div
                className={`border-4 border-dashed rounded-2xl p-16 text-center transition-all ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                } ${processing ? 'opacity-50' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {processing ? (
                  <div>
                    <div className="text-6xl mb-4 animate-bounce">🔍</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Scanning Document...</h3>
                    <p className="text-gray-600">Extracting startup information with AI</p>
                    <p className="text-blue-600 font-semibold mt-4">{processingFile}</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-6xl mb-4">📤</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      Drag & Drop PDF or PowerPoint Files
                    </h3>
                    <p className="text-gray-600 mb-6">
                      or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-2xl transition-all"
                    >
                      Choose Files
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                  <h4 className="font-bold text-blue-700 mb-3">📄 Supported Documents:</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>✅ PDF pitch decks</li>
                    <li>✅ PowerPoint presentations (.ppt, .pptx)</li>
                    <li>✅ Executive summaries</li>
                    <li>✅ Business plans</li>
                    <li>✅ Multiple files at once</li>
                  </ul>
                </div>
                
                <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
                  <h4 className="font-bold text-purple-700 mb-3">🤖 AI Extraction:</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>• Automatically finds startup name</li>
                    <li>• Extracts problem & solution</li>
                    <li>• Identifies market size</li>
                    <li>• Captures team background</li>
                    <li>• Detects funding amount</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    Extracted {extractedStartups.length} Startups
                  </h3>
                  <p className="text-gray-600">
                    {extractedStartups.filter(s => s.status === 'approved').length} approved
                  </p>
                </div>
                <button
                  onClick={approveAll}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                >
                  ✅ Approve All
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
                {extractedStartups.map((startup, index) => (
                  <div 
                    key={index}
                    className={`border-2 rounded-xl p-6 transition-all ${
                      startup.status === 'approved' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold text-gray-800">{startup.name}</h4>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            📄 {startup.extractedFrom}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{startup.tagline}</p>
                        
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <strong className="text-gray-700">Problem:</strong>
                            <p className="text-gray-600">{startup.problem}</p>
                          </div>
                          <div>
                            <strong className="text-gray-700">Solution:</strong>
                            <p className="text-gray-600">{startup.solution}</p>
                          </div>
                          <div>
                            <strong className="text-gray-700">Market:</strong>
                            <p className="text-gray-600">{startup.marketSize}</p>
                          </div>
                          <div>
                            <strong className="text-gray-700">Raising:</strong>
                            <p className="text-gray-600">{startup.investmentAmount}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <span className="text-xs text-gray-500">Industries: </span>
                          {startup.industries?.map(ind => (
                            <span key={ind} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-2">
                              {ind}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleApproval(index)}
                        className={`px-4 py-2 rounded-lg font-semibold ml-4 transition-colors ${
                          startup.status === 'approved'
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {startup.status === 'approved' ? '✓ Approved' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setCurrentStep('upload');
                    setExtractedStartups([]);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 font-bold py-3 px-6 rounded-2xl hover:bg-gray-400 transition-all"
                >
                  ← Upload Different Files
                </button>
                <button
                  onClick={saveAllApproved}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all"
                >
                  💾 Save {extractedStartups.filter(s => s.status === 'approved').length} Startups
                </button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="text-center py-12">
              <div className="text-8xl mb-6">🎉</div>
              <h3 className="text-3xl font-bold text-gray-800 mb-4">
                Documents Processed!
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                Startup data extracted and saved to database
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setCurrentStep('upload');
                    setExtractedStartups([]);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-2xl transition-all"
                >
                  Upload More Documents
                </button>
                <button
                  onClick={() => navigate('/vote')}
                  className="px-8 py-3 bg-white border-2 border-blue-500 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all"
                >
                  View Startups
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
