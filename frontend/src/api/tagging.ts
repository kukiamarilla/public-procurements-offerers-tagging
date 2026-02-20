const API_BASE = '/api';

export interface Offerer {
  id: string;
  name?: string;
}

export interface TaggingTask {
  ocid?: string;
  tenderId: string;
  awardIds: string[];
  offerers: Offerer[];
  pdfUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SaveResultBody {
  ocid?: string;
  tenderId: string;
  awardIds?: string[];
  offererCount: number;
  metadata?: Record<string, unknown>;
}

export async function fetchTasks(limit?: number, offset?: number): Promise<TaggingTask[]> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  const url = `${API_BASE}/tagging/tasks${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  const data = await res.json();
  return data.tasks ?? [];
}

export async function saveResult(body: SaveResultBody): Promise<void> {
  const res = await fetch(`${API_BASE}/tagging/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to save result: ${res.status}`);
}
