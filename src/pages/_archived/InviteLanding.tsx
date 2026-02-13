// InviteLanding - Landing page for /i/:token invite links
// Prompt 24: Referral/Invite Loop

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storePendingInvite } from '../lib/referral';

export default function InviteLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (token) {
      // Store token for post-signup acceptance
      storePendingInvite(token);
      // Redirect to signup
      navigate('/signup/founder');
    }
  }, [token, navigate]);
  
  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-3 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );
}
