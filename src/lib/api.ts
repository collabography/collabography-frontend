/**
 * API 클라이언트
 * 백엔드 연동을 위한 기본 구조
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// ============================================
// Base Fetch Wrapper
// ============================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.error?.message || error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================
// Project APIs
// ============================================

export const projectApi = {
  // 프로젝트 목록
  list: () => apiFetch<{
    items: Array<{
      project_id: number;
      title: string;
      music_duration_sec: number | null;
      created_at: string;
    }>;
    next_cursor: string | null;
  }>('/projects'),
  
  // 프로젝트 생성
  create: (title: string) => apiFetch<{
    project_id: number;
    tracks: Array<{ track_id: number; slot: number }>;
  }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),
  
  // Edit State 로딩
  getEditState: (projectId: number) => apiFetch<{
    project: {
      id: number;
      title: string;
      music: {
        object_key: string | null;
        duration_sec: number;
        bpm: number | null;
      };
    };
    tracks: Array<{
      track_id: number;
      slot: number;
      display_name: string | null;
      layers: Array<{
        layer_id: number;
        start_sec: number;
        end_sec: number;
        priority: number;
        label: string | null;
        fade_in_sec: number;
        fade_out_sec: number;
        skeleton: {
          source_id: number;
          status: string;
          object_key: string | null;
          fps: number;
          num_frames: number;
          num_joints: number;
          pose_model: string | null;
        };
      }>;
      position_keyframes: Array<{
        id: number;
        time_sec: number;
        x: number;
        y: number;
        interp: string;
      }>;
    }>;
  }>(`/projects/${projectId}/edit-state`),
};

// ============================================
// Music APIs
// ============================================

export const musicApi = {
  // 업로드 URL 발급
  initUpload: (projectId: number, fileName: string, contentType: string) => 
    apiFetch<{
      upload_url: string;
      object_key: string;
    }>(`/projects/${projectId}/music/upload-init`, {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, content_type: contentType }),
    }),
  
  // 음악 메타 확정
  confirmUpload: (projectId: number, objectKey: string, durationSec: number, bpm?: number) =>
    apiFetch<{ updated: boolean }>(`/projects/${projectId}/music`, {
      method: 'PUT',
      body: JSON.stringify({
        object_key: objectKey,
        duration_sec: durationSec,
        bpm: bpm ?? null,
      }),
    }),
};

// ============================================
// Layer APIs
// ============================================

export const layerApi = {
  // 업로드 URL 발급
  initUpload: (trackId: number, uploadKind: 'VIDEO' | 'SKELETON_JSON', fileName: string, contentType: string) =>
    apiFetch<{
      upload_url: string;
      object_key: string;
    }>(`/tracks/${trackId}/layers/upload-init`, {
      method: 'POST',
      body: JSON.stringify({
        upload_kind: uploadKind,
        file_name: fileName,
        content_type: contentType,
      }),
    }),
  
  // 레이어 생성
  create: (trackId: number, data: {
    label: string | null;
    start_sec: number;
    end_sec: number;
    priority: number;
    fade_in_sec: number;
    fade_out_sec: number;
    input: {
      kind: 'VIDEO';
      video_object_key: string;
    } | {
      kind: 'SKELETON_JSON';
      skeleton_object_key: string;
      fps: number;
      num_frames: number;
      num_joints: number;
      pose_model: string;
    };
  }) => apiFetch<{
    layer: {
      layer_id: number;
      track_id: number;
      start_sec: number;
      end_sec: number;
      priority: number;
      label: string | null;
      fade_in_sec: number;
      fade_out_sec: number;
      skeleton: {
        source_id: number;
        status: string;
        object_key: string | null;
      };
    };
  }>(`/tracks/${trackId}/layers`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // 레이어 수정
  update: (layerId: number, data: {
    start_sec?: number;
    end_sec?: number;
    priority?: number;
    label?: string;
    fade_in_sec?: number;
    fade_out_sec?: number;
  }) => apiFetch<{ updated: boolean }>(`/layers/${layerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  // 레이어 삭제
  delete: (layerId: number) => apiFetch<{ deleted: boolean }>(`/layers/${layerId}`, {
    method: 'DELETE',
  }),
  
  // 레이어 상태 확인
  get: (layerId: number) => apiFetch<{
    layer_id: number;
    start_sec: number;
    end_sec: number;
    priority: number;
    label: string | null;
    fade_in_sec: number;
    fade_out_sec: number;
    skeleton: {
      source_id: number;
      status: string;
      object_key: string | null;
      fps: number;
      num_frames: number;
      num_joints: number;
      pose_model: string | null;
    };
  }>(`/layers/${layerId}`),
};

// ============================================
// Position Keyframes APIs
// ============================================

export const keyframeApi = {
  // 키프레임 전체 교체
  update: (trackId: number, keyframes: Array<{
    time_sec: number;
    x: number;
    y: number;
    interp: 'STEP' | 'LINEAR';
  }>) => apiFetch<{ updated: boolean }>(`/tracks/${trackId}/position-keyframes`, {
    method: 'PUT',
    body: JSON.stringify({ keyframes }),
  }),
};

// ============================================
// MinIO Direct Upload
// ============================================

export async function uploadToMinIO(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

// ============================================
// Skeleton JSON Loader
// ============================================

import type { SkeletonJson } from '@/types';

const skeletonCache = new Map<string, SkeletonJson>();

export async function loadSkeletonJson(objectKey: string): Promise<SkeletonJson> {
  // 캐시 확인
  if (skeletonCache.has(objectKey)) {
    return skeletonCache.get(objectKey)!;
  }
  
  // MinIO에서 로드 (백엔드가 프록시하거나 직접 접근)
  const minioBaseUrl = import.meta.env.VITE_MINIO_BASE_URL || '/minio';
  const response = await fetch(`${minioBaseUrl}/${objectKey}`);
  
  if (!response.ok) {
    throw new Error(`Failed to load skeleton: ${response.status}`);
  }
  
  const json = await response.json() as SkeletonJson;
  
  // 캐시에 저장
  skeletonCache.set(objectKey, json);
  
  return json;
}

export function clearSkeletonCache(objectKey?: string): void {
  if (objectKey) {
    skeletonCache.delete(objectKey);
  } else {
    skeletonCache.clear();
  }
}

