import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type VideoEntityType = 'startup' | 'investor';

export interface VideoEvidenceSnippet {
  id: string;
  entityId: string;
  title: string;
  channelName: string | null;
  sourceUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  startSeconds: number;
  endSeconds: number;
  evidenceType: string;
  excerpt: string;
  confidence: number;
}

export type VideoEvidenceMap = Record<string, VideoEvidenceSnippet[]>;

function withStart(url: string | null, seconds: number): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('start', String(seconds));
    return parsed.toString();
  } catch {
    return url;
  }
}

function watchAt(url: string, seconds: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('t', `${seconds}s`);
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function fetchVerifiedVideoEvidence(
  entityType: VideoEntityType,
  entityIds: string[],
): Promise<VideoEvidenceMap> {
  const ids = [...new Set(entityIds.filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('profile_video_snippets')
    .select(`
      id, entity_id, start_seconds, end_seconds, transcript_excerpt,
      evidence_type, confidence,
      profile_video_sources!inner (
        title, channel_name, source_url, embed_url, thumbnail_url,
        resolution_status
      )
    `)
    .eq('entity_type', entityType)
    .eq('verification_status', 'verified')
    .eq('profile_video_sources.resolution_status', 'verified')
    .in('entity_id', ids)
    .order('confidence', { ascending: false })
    .limit(Math.min(ids.length * 10, 200));

  if (error || !data) return {};

  return data.reduce<VideoEvidenceMap>((map, raw: any) => {
    const source = Array.isArray(raw.profile_video_sources)
      ? raw.profile_video_sources[0]
      : raw.profile_video_sources;
    if (!source?.source_url) return map;
    const entityId = String(raw.entity_id);
    const current = map[entityId] || [];
    if (current.length >= 3) return map;
    current.push({
      id: String(raw.id),
      entityId,
      title: source.title || 'Video evidence',
      channelName: source.channel_name || null,
      sourceUrl: watchAt(source.source_url, Number(raw.start_seconds) || 0),
      embedUrl: withStart(source.embed_url, Number(raw.start_seconds) || 0),
      thumbnailUrl: source.thumbnail_url || null,
      startSeconds: Number(raw.start_seconds) || 0,
      endSeconds: Number(raw.end_seconds) || 0,
      evidenceType: String(raw.evidence_type || 'other'),
      excerpt: String(raw.transcript_excerpt || ''),
      confidence: Number(raw.confidence) || 0,
    });
    map[entityId] = current;
    return map;
  }, {});
}

export function useVideoEvidenceMap(entityType: VideoEntityType, entityIds: string[]): VideoEvidenceMap {
  const key = useMemo(() => [...new Set(entityIds.filter(Boolean))].sort().join(','), [entityIds]);
  const [evidence, setEvidence] = useState<VideoEvidenceMap>({});

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setEvidence({});
      return;
    }
    fetchVerifiedVideoEvidence(entityType, ids).then((result) => {
      if (!cancelled) setEvidence(result);
    });
    return () => { cancelled = true; };
  }, [entityType, key]);

  return evidence;
}
