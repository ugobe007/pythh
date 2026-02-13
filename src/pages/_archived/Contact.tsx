import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Contact() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send this to a backend
    console.log('Contact form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 p-8 relative">
      {/* Radial green accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-green-400 rounded-full blur-3xl opacity-40" style={{left: '20%', top: '40%'}}></div>
      </div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all"
          >
            ← Home
          </button>
        </div>

        {/* Content Container */}
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-8xl mb-4">💬</div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-500 bg-clip-text text-transparent mb-4">
              Contact Us
            </h1>
            <p className="text-xl text-gray-700 font-medium">
              We'd love to hear from you!
            </p>
          </div>

          {/* Contact Info */}
          <div className="mb-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-cyan-600 mb-2 flex items-center gap-2">
                  📧 Email Us
                </h3>
                <p className="text-gray-700">
                  <a href="mailto:hello@hotmoneyhoney.com" className="text-cyan-600 hover:text-cyan-400 underline">
                    hello@hotmoneyhoney.com
                  </a>
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-cyan-600 mb-2 flex items-center gap-2">
                  🕒 Response Time
                </h3>
                <p className="text-gray-700">
                  We typically respond within 24-48 hours
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Send us a message</h2>
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-xl text-center">
                <p className="text-green-800 font-semibold">✅ Thank you! We'll get back to you soon.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-bold text-gray-700 mb-2">
                  Subject *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors"
                >
                  <option value="">Select a topic...</option>
                  <option value="investor">I'm an Investor</option>
                  <option value="startup">I'm a Startup</option>
                  <option value="partnership">Partnership Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors resize-none"
                  placeholder="Tell us how we can help..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all text-lg"
              >
                📤 Send Message
              </button>
            </form>
          </div>

          {/* Additional Info */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-purple-700 mb-3">💡 Common Questions?</h3>
            <p className="text-gray-700 mb-3">
              Before reaching out, you might find what you're looking for in our resources:
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/why')}
                className="px-4 py-2 bg-white border-2 border-purple-300 rounded-lg text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
              >
                📖 About Us
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-white border-2 border-purple-300 rounded-lg text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
              >
                🔥 How It Works
              </button>
              <button
                onClick={() => navigate('/submit')}
                className="px-4 py-2 bg-white border-2 border-purple-300 rounded-lg text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
              >
                🚀 For Startups
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
