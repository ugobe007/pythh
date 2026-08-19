'use strict';

// startup_uploads.stage is a 1–5 scale. Zero is retained only for legacy
// idea-stage records; it must never shift Seed (2) into Series A.
const STARTUP_STAGE_LABELS = Object.freeze({
  0: 'Idea',
  1: 'Pre-Seed',
  2: 'Seed',
  3: 'Series A',
  4: 'Series B',
  5: 'Series C',
});

function stageLabel(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return STARTUP_STAGE_LABELS[value] || String(value);
  }
  return value;
}

module.exports = { STARTUP_STAGE_LABELS, stageLabel };

