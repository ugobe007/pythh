/**
 * Share Signal Card Modal
 * 
 * Allows founders to share signal cards with:
 * - Investors (via email or link)
 * - Advisors & team members
 * - Other founders (public collections)
 * 
 * Also handles adding to collections.
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Link2, 
  Mail, 
  Copy, 
  Check, 
  Users, 
  FolderPlus,
  Globe,
  Lock,
  Clock,
  MessageSquare,
  Twitter,
  Linkedin,
  Share2
} from 'lucide-react';
import { 
  createShareLink, 
  shareViaEmail,
  createCollection,
  addToCollection,
  getMyCollections,
  copyToClipboard,
  type SignalCardCollection 
} from '../services/signalCardSharingService';

interface ShareSignalCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    entity_name: string | null;
    entity_type: string;
    lens_id?: string | null;
    score_value?: number | null;
    rank?: number | null;
    notes?: { note: string }[];
  };
}

type ShareTab = 'link' | 'email' | 'collection' | 'social';

export default function ShareSignalCardModal({ isOpen, onClose, item }: ShareSignalCardModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('link');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [canComment, setCanComment] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [collections, setCollections] = useState<SignalCardCollection[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadCollections = async () => {
    const { collections } = await getMyCollections();
    setCollections(collections);
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);
    const result = await createShareLink(item.id, {
      canComment,
      expiresInDays: expiresInDays || undefined,
    });
    setIsLoading(false);

    if (result.success && result.shareUrl) {
      setShareUrl(result.shareUrl);
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCopyText = async () => {
    const success = await copyToClipboard(item);
    if (success) {
      setSuccessMessage('Copied to clipboard!');
    }
  };

  const handleSendEmail = async () => {
    if (!email) return;
    
    setIsLoading(true);
    const result = await shareViaEmail(item.id, email, { canComment, message });
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Share invitation sent!');
      setEmail('');
      setMessage('');
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    setIsLoading(true);
    const result = await addToCollection(collectionId, item.id);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Added to collection!');
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setIsLoading(true);
    const result = await createCollection(newCollectionName.trim());
    setIsLoading(false);

    if (result.success && result.collection) {
      // Add item to new collection
      await addToCollection(result.collection.id, item.id);
      setSuccessMessage('Collection created and item added!');
      setNewCollectionName('');
      setShowNewCollection(false);
      loadCollections();
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'linkedin') => {
    const text = `📡 Tracking "${item.entity_name}" on PYTHH — Capital moves in patterns.`;
    const url = shareUrl || window.location.href;

    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-white font-semibold">Share Signal Card</h2>
              <p className="text-zinc-500 text-sm">{item.entity_name || 'Unknown'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mx-6 mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {[
            { id: 'link', icon: Link2, label: 'Link' },
            { id: 'email', icon: Mail, label: 'Email' },
            { id: 'collection', icon: FolderPlus, label: 'Collections' },
            { id: 'social', icon: Users, label: 'Social' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ShareTab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-violet-500 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Link Tab */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              {!shareUrl ? (
                <>
                  <p className="text-zinc-400 text-sm">
                    Generate a shareable link for this signal card. Anyone with the link can view it.
                  </p>

                  {/* Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={canComment}
                        onChange={(e) => setCanComment(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500/50"
                      />
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare className="w-4 h-4 text-zinc-500" />
                        <span className="text-zinc-300">Allow comments</span>
                      </div>
                    </label>

                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <select
                        value={expiresInDays || ''}
                        onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        <option value="">Never expires</option>
                        <option value="1">Expires in 1 day</option>
                        <option value="7">Expires in 7 days</option>
                        <option value="30">Expires in 30 days</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateLink}
                    disabled={isLoading}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Generating...' : 'Generate Share Link'}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`p-2 rounded-lg transition-colors ${
                        isCopied 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <button
                    onClick={() => setShareUrl(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Generate new link
                  </button>
                </>
              )}
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                Share directly with an investor, advisor, or team member via email.
              </p>

              <div>
                <label className="block text-zinc-400 text-sm mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@vc.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-1">Message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Here's a signal I've been tracking..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canComment}
                  onChange={(e) => setCanComment(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-zinc-400 text-sm">Allow them to comment</span>
              </label>

              <button
                onClick={handleSendEmail}
                disabled={isLoading || !email}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          )}

          {/* Collections Tab */}
          {activeTab === 'collection' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                Add to a collection to organize and share multiple signals together.
              </p>

              {/* Existing collections */}
              {collections.length > 0 && (
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleAddToCollection(collection.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FolderPlus className="w-4 h-4 text-zinc-500 group-hover:text-violet-400 transition-colors" />
                        <div className="text-left">
                          <p className="text-zinc-300 text-sm font-medium">{collection.name}</p>
                          <p className="text-zinc-600 text-xs">
                            {collection.item_count || 0} items
                            {collection.is_public && (
                              <span className="ml-2 text-emerald-500">
                                <Globe className="w-3 h-3 inline" /> Public
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="text-zinc-600 text-sm group-hover:text-violet-400 transition-colors">
                        Add →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Create new collection */}
              {showNewCollection ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name..."
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCollection}
                      disabled={isLoading || !newCollectionName.trim()}
                      className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Create & Add
                    </button>
                    <button
                      onClick={() => {
                        setShowNewCollection(false);
                        setNewCollectionName('');
                      }}
                      className="px-4 py-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCollection(true)}
                  className="w-full py-3 border border-dashed border-zinc-700 hover:border-violet-500/50 text-zinc-500 hover:text-violet-400 rounded-lg text-sm transition-colors"
                >
                  + Create new collection
                </button>
              )}
            </div>
          )}

          {/* Social Tab */}
          {activeTab === 'social' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                Share with your network or copy a formatted summary.
              </p>

              {/* Social buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSocialShare('twitter')}
                  className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                  Twitter
                </button>
                <button
                  onClick={() => handleSocialShare('linkedin')}
                  className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                  LinkedIn
                </button>
              </div>

              {/* Copy formatted text */}
              <button
                onClick={handleCopyText}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy as text
              </button>

              {/* Preview */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Preview</p>
                <div className="text-zinc-300 text-sm space-y-1">
                  <p>📡 Signal Card: {item.entity_name || 'Unknown'}</p>
                  <p className="text-zinc-500">Type: {item.entity_type}</p>
                  {item.lens_id && <p className="text-zinc-500">Lens: {item.lens_id}</p>}
                  {item.score_value && <p className="text-zinc-500">Score: {item.score_value}</p>}
                  <p className="text-zinc-600 text-xs mt-2 italic">Powered by PYTHH</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
