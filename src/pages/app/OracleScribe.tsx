// ============================================================================
// Oracle Scribe Page
// ============================================================================
// Full-page journal interface

import React from 'react';
import { OracleScribe } from '../../components/OracleScribe';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

export default function OracleScribePage() {
  const startupId = useOracleStartupId();

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <OracleScribe startupId={startupId || undefined} />
      </div>
    </div>
  );
}
