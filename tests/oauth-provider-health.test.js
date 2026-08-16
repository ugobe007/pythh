'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractClientIdFromAuthorizeUrl,
  isUsableOAuthClientId,
  oauthClientIdErrorMessage,
  summarizeProbe,
} = require('../lib/oauthProviderHealth');

describe('isUsableOAuthClientId', () => {
  it('rejects empty and placeholder LinkedIn client ids', () => {
    for (const value of ['', 'INVALID', 'your_client_id', 'undefined', 'null', 'xxx']) {
      assert.equal(isUsableOAuthClientId('linkedin_oidc', value), false, value);
    }
  });

  it('accepts a LinkedIn consumer key', () => {
    assert.equal(isUsableOAuthClientId('linkedin_oidc', '86abcdefghijklmnopqrst'), true);
  });

  it('accepts Google and GitHub client id shapes', () => {
    assert.equal(
      isUsableOAuthClientId(
        'google',
        '811242626282-8ea38mk71lcvopqk5s7f7vppo5gqr1gl.apps.googleusercontent.com',
      ),
      true,
    );
    assert.equal(isUsableOAuthClientId('github', 'Ov23liZiQkyV0EofsXOh'), true);
  });

  it('rejects a Google id used as a LinkedIn client', () => {
    assert.equal(
      isUsableOAuthClientId(
        'linkedin_oidc',
        '811242626282-8ea38mk71lcvopqk5s7f7vppo5gqr1gl.apps.googleusercontent.com',
      ),
      false,
    );
  });
});

describe('extractClientIdFromAuthorizeUrl', () => {
  it('reads client_id from a LinkedIn authorize URL', () => {
    const url =
      'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=86abcxyz12&redirect_uri=https%3A%2F%2Fexample.supabase.co%2Fauth%2Fv1%2Fcallback';
    assert.equal(extractClientIdFromAuthorizeUrl(url), '86abcxyz12');
  });
});

describe('summarizeProbe', () => {
  it('marks LinkedIn not_enabled when Supabase rejects the provider', () => {
    const summary = summarizeProbe('linkedin_oidc', {
      status: 400,
      location: null,
      body: '{"msg":"Unsupported provider: provider is not enabled"}',
    });
    assert.deepEqual(summary, {
      provider: 'linkedin_oidc',
      enabled: false,
      ready: false,
      reason: 'not_enabled',
    });
  });

  it('refuses to send users to LinkedIn when client_id is invalid', () => {
    const summary = summarizeProbe('linkedin_oidc', {
      status: 302,
      location:
        'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=INVALID&redirect_uri=https://example.com',
      body: '',
    });
    assert.equal(summary.enabled, true);
    assert.equal(summary.ready, false);
    assert.equal(summary.reason, 'invalid_client_id');
  });

  it('marks LinkedIn ready only with a usable client_id on linkedin.com', () => {
    const summary = summarizeProbe('linkedin_oidc', {
      status: 302,
      location:
        'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=86abcdefghijklmnopqrst&redirect_uri=https://example.com',
      body: '',
    });
    assert.deepEqual(summary, {
      provider: 'linkedin_oidc',
      enabled: true,
      ready: true,
      reason: undefined,
    });
  });
});

describe('oauthClientIdErrorMessage', () => {
  it('rewrites LinkedIn Forwarding invalid client_id copy', () => {
    assert.match(
      oauthClientIdErrorMessage('Forwarding... Error: Invalid client_id. Please try again.'),
      /LinkedIn sign-in is misconfigured/,
    );
  });
});
