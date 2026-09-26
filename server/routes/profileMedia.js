'use strict';

/**
 * Founder account uploads — one pitch deck and any videos.
 * Bytes go straight to private Supabase Storage via a signed upload URL.
 * This route only authorizes, records, and signs downloads.
 */

const express = require('express');
const { getSupabaseClient } = require('../lib/supabaseClient');
const { getAuthedUserFromRequest } = require('../lib/pythhSession');
const {
  BUCKET,
  MAX_VIDEOS,
  classifyUpload,
  maxBytes,
  buildStoragePath,
  parseOwnedPath,
} = require('../lib/profileMediaPolicy');

const router = express.Router();
const SIGNED_URL_SECONDS = 60 * 60;

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

async function requireUser(req, res) {
  try {
    const user = await getAuthedUserFromRequest(req);
    if (!user) {
      jsonError(res, 401, 'Sign in to manage files on your profile.');
      return null;
    }
    return user;
  } catch (err) {
    console.error('[profile-media] auth failed:', err);
    jsonError(res, 500, 'Could not verify your session.');
    return null;
  }
}

async function ensureBucket(supabase) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 100 * 1024 * 1024,
  });
  if (error && !/already exists|duplicate/i.test(error.message || '')) {
    throw error;
  }
}

function isMissingTable(error) {
  const message = String(error?.message || error?.details || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /pythh_founder_media/i.test(message);
}

async function signedViewUrl(supabase, storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (error) return null;
  return data?.signedUrl || null;
}

function toItem(row, url) {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    url,
  };
}

async function statObject(supabase, storagePath) {
  const slash = storagePath.lastIndexOf('/');
  const folder = storagePath.slice(0, slash);
  const name = storagePath.slice(slash + 1);
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    search: name,
    limit: 20,
  });
  if (error) throw error;
  const hit = (data || []).find((row) => row.name === name);
  if (!hit) return null;
  const meta = hit.metadata || {};
  const size = Number(meta.size ?? meta.contentLength ?? hit.size ?? 0);
  const mime = meta.mimetype || meta.contentType || null;
  return { size, mime };
}

async function attachDeckToStartup(supabase, userId, fileName, storagePath) {
  const { data: profile, error: profileErr } = await supabase
    .from('pythh_founder_profiles')
    .select('startup_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileErr) {
    console.error('[profile-media] profile lookup failed:', profileErr.message);
  }

  const deckKey = storagePath.slice(0, 256);
  const { error: upsertErr } = await supabase.from('pythh_founder_profiles').upsert(
    {
      user_id: userId,
      deck_file_key: deckKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (upsertErr) console.error('[profile-media] deck key save failed:', upsertErr.message);

  const startupId = profile?.startup_id;
  if (!startupId) return;
  const { error: startupErr } = await supabase
    .from('startup_uploads')
    .update({
      deck_filename: fileName,
      deck_url: `${BUCKET}/${storagePath}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', startupId);
  if (startupErr) console.error('[profile-media] startup deck link failed:', startupErr.message);
}

async function clearDeckPointers(supabase, userId, storagePath) {
  const { data: profile } = await supabase
    .from('pythh_founder_profiles')
    .select('startup_id, deck_file_key')
    .eq('user_id', userId)
    .maybeSingle();
  if (profile?.deck_file_key && profile.deck_file_key === storagePath.slice(0, 256)) {
    await supabase
      .from('pythh_founder_profiles')
      .update({ deck_file_key: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
  if (!profile?.startup_id) return;
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('deck_url')
    .eq('id', profile.startup_id)
    .maybeSingle();
  if (startup?.deck_url === `${BUCKET}/${storagePath}`) {
    await supabase
      .from('startup_uploads')
      .update({ deck_filename: null, deck_url: null, updated_at: new Date().toISOString() })
      .eq('id', profile.startup_id);
  }
}

router.get('/', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pythh_founder_media')
      .select('id, kind, file_name, mime_type, size_bytes, storage_path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        return jsonError(res, 503, 'Profile uploads are not ready yet.');
      }
      throw error;
    }
    const rows = data || [];
    const items = await Promise.all(rows.map(async (row) => toItem(row, await signedViewUrl(supabase, row.storage_path))));
    const deck = items.find((item) => item.kind === 'deck') || null;
    const videos = items.filter((item) => item.kind === 'video');
    res.json({ deck, videos });
  } catch (err) {
    console.error('[profile-media] list failed:', err);
    jsonError(res, 500, 'Could not load your files.');
  }
});

router.post('/sign', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const fileName = String(req.body?.fileName || '').trim();
  const mimeType = String(req.body?.mimeType || '');
  const sizeBytes = Number(req.body?.sizeBytes);
  const classified = classifyUpload({ fileName, mimeType });
  if (classified.error) return jsonError(res, 400, classified.error);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return jsonError(res, 400, 'Choose a file to upload.');
  }
  if (sizeBytes > maxBytes(classified.kind)) {
    const limitMb = Math.round(maxBytes(classified.kind) / (1024 * 1024));
    return jsonError(res, 400, `That ${classified.kind} is over the ${limitMb} MB limit.`);
  }

  try {
    const supabase = getSupabaseClient();
    await ensureBucket(supabase);
    if (classified.kind === 'video') {
      const { count, error: countErr } = await supabase
        .from('pythh_founder_media')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('kind', 'video');
      if (countErr) {
        if (isMissingTable(countErr)) return jsonError(res, 503, 'Profile uploads are not ready yet.');
        throw countErr;
      }
      if ((count || 0) >= MAX_VIDEOS) {
        return jsonError(res, 400, `You can keep up to ${MAX_VIDEOS} videos on your profile.`);
      }
    }

    const storagePath = buildStoragePath(user.id, classified.kind, fileName);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath, {
      upsert: false,
    });
    if (error || !data?.signedUrl || !data?.token) {
      console.error('[profile-media] sign failed:', error);
      return jsonError(res, 500, 'Could not start the upload.');
    }
    res.json({
      kind: classified.kind,
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err) {
    console.error('[profile-media] sign error:', err);
    jsonError(res, 500, 'Could not start the upload.');
  }
});

router.post('/commit', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const owned = parseOwnedPath(user.id, req.body?.storagePath);
  if (!owned) return jsonError(res, 400, 'That upload could not be verified.');
  const fileName = String(req.body?.fileName || owned.fileName).trim().slice(0, 180);
  const mimeType = String(req.body?.mimeType || '');
  const classified = classifyUpload({ fileName, mimeType });
  if (classified.error || classified.kind !== owned.kind) {
    return jsonError(res, 400, classified.error || 'That file type does not match the upload.');
  }

  try {
    const supabase = getSupabaseClient();
    const { data: existing, error: existingErr } = await supabase
      .from('pythh_founder_media')
      .select('id, kind, file_name, mime_type, size_bytes, storage_path, created_at')
      .eq('user_id', user.id)
      .eq('storage_path', owned.path)
      .maybeSingle();
    if (existingErr && !isMissingTable(existingErr)) throw existingErr;
    if (existing) {
      return res.json({ item: toItem(existing, await signedViewUrl(supabase, existing.storage_path)) });
    }

    const stat = await statObject(supabase, owned.path);
    if (!stat) return jsonError(res, 400, 'The file did not finish uploading. Try again.');
    if (stat.size > maxBytes(owned.kind)) {
      await supabase.storage.from(BUCKET).remove([owned.path]);
      const limitMb = Math.round(maxBytes(owned.kind) / (1024 * 1024));
      return jsonError(res, 400, `That ${owned.kind} is over the ${limitMb} MB limit.`);
    }

    if (owned.kind === 'video') {
      const { count, error: countErr } = await supabase
        .from('pythh_founder_media')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('kind', 'video');
      if (countErr) throw countErr;
      if ((count || 0) >= MAX_VIDEOS) {
        await supabase.storage.from(BUCKET).remove([owned.path]);
        return jsonError(res, 400, `You can keep up to ${MAX_VIDEOS} videos on your profile.`);
      }
    }

    const sizeBytes = Math.max(0, Math.round(stat.size > 0 ? stat.size : Number(req.body?.sizeBytes) || 0));
    const { data: inserted, error: insertErr } = await supabase
      .from('pythh_founder_media')
      .insert({
        user_id: user.id,
        kind: owned.kind,
        file_name: fileName,
        mime_type: stat.mime || classified.mime,
        storage_path: owned.path,
        size_bytes: sizeBytes,
      })
      .select('id, kind, file_name, mime_type, size_bytes, storage_path, created_at')
      .single();
    if (insertErr) {
      if (isMissingTable(insertErr)) return jsonError(res, 503, 'Profile uploads are not ready yet.');
      throw insertErr;
    }

    if (owned.kind === 'deck') {
      const { data: previous } = await supabase
        .from('pythh_founder_media')
        .select('id, storage_path')
        .eq('user_id', user.id)
        .eq('kind', 'deck');
      const stale = (previous || []).filter((row) => row.storage_path !== owned.path);
      if (stale.length) {
        await supabase.storage.from(BUCKET).remove(stale.map((row) => row.storage_path));
        await supabase.from('pythh_founder_media').delete().in('id', stale.map((row) => row.id));
      }
    }

    if (owned.kind === 'deck') {
      await attachDeckToStartup(supabase, user.id, fileName, owned.path);
    }

    res.json({ item: toItem(inserted, await signedViewUrl(supabase, inserted.storage_path)) });
  } catch (err) {
    console.error('[profile-media] commit failed:', err);
    jsonError(res, 500, 'Could not save that file to your profile.');
  }
});

router.delete('/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(res, 400, 'Unknown file.');

  try {
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('pythh_founder_media')
      .select('id, kind, storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return jsonError(res, 503, 'Profile uploads are not ready yet.');
      throw error;
    }
    if (!row) return jsonError(res, 404, 'That file is not on your profile.');

    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (removeErr) console.error('[profile-media] storage remove failed:', removeErr.message);
    const { error: deleteErr } = await supabase.from('pythh_founder_media').delete().eq('id', row.id).eq('user_id', user.id);
    if (deleteErr) throw deleteErr;
    if (row.kind === 'deck') await clearDeckPointers(supabase, user.id, row.storage_path);
    res.json({ ok: true });
  } catch (err) {
    console.error('[profile-media] delete failed:', err);
    jsonError(res, 500, 'Could not remove that file.');
  }
});

module.exports = router;
