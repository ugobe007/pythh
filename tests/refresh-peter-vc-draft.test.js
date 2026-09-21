'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { refreshPeterVcDraft, isStalePeterVcCopy } = require('../lib/refreshPeterVcDraft.js');

const OLD_HTML = `<!DOCTYPE html>
<title>Peter · Pythh · LAUNCH</title>
<h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.35;margin:0 0 14px;">
      10 SaaS startups — conviction signals
    </h1>
    <p style="color:#64748b;font-size:14px;line-height:1.65;margin:0 0 8px;">
      Hi Jason, I noticed something you may want to see — 10 startups whose recent signals appear to align with your firm's recent deployment patterns. I noticed Softr raised $2M to work on Most AI app-builders stop at the shiny demo stage. Rankings reflect conviction signals, not category labels — sector fit, stage, traction, and alignment with how you actually deploy. Take a look below. Are any of these picks worth a discussion?
    </p>
    <div style="font-weight:600;color:#f1f5f9;font-size:14px;margin-bottom:2px;">Softr</div>
    <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                color:#475569;font-family:monospace;margin-bottom:10px;">HOW THESE WERE RANKED</div>
    <p style="color:#64748b;font-size:13px;line-height:1.65;margin:0;">
      Rankings reflect sector and stage fit, team strength, traction, recent market activity, and alignment with your focus. The list updates as conviction signals shift.
    </p>`;

describe('refreshPeterVcDraft', () => {
  it('rewrites stored admin draft HTML without dropping the startup list', () => {
    const next = refreshPeterVcDraft({
      html_body: OLD_HTML,
      text_body: '10 SaaS startups — conviction signals\n\nHi Jason, I noticed something you may want to see\n\n  1. Softr  |  Match: 88\n\nRankings reflect conviction signals\n',
      subject: '10 SaaS startups — recent signals for your review',
      target_name: 'Jason Calacanis · LAUNCH',
    });

    assert.equal(next.changed, true);
    assert.equal(next.subject, '10 startups that match your thesis');
    assert.match(next.html_body, /10 curated startups for review/);
    assert.match(next.html_body, /Hi Jason, my name is Peter\. I am an investment analyst for Pythh\.AI\./);
    assert.match(next.html_body, /One startup, Softr fits LAUNCH's thesis and narrative that may interest you\./);
    assert.match(next.html_body, /We use 24 algorithms to identify possible candidates for investment including thesis, traction, timing and team\./);
    assert.match(next.html_body, />Softr</);
    assert.doesNotMatch(next.html_body, /I noticed something you may want to see/);
    assert.doesNotMatch(next.html_body, /how you actually deploy/);
    assert.doesNotMatch(next.html_body, /conviction signals/);
    assert.equal(isStalePeterVcCopy(next.html_body, next.text_body, next.subject), false);
  });
});
