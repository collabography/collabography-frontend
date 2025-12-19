/**
 * API 클라이언트
 * 백엔드 연동을 위한 기본 구조
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
      id: number;
      title: string;
      music_object_key: string | null;
      music_duration_sec: string | null;  // Decimal은 string으로 옴
      music_bpm: string | null;
      created_at: string;
      updated_at: string;
    }>;
    next_cursor: string | null;
    has_more: boolean;
  }>('/projects'),
  
  // 프로젝트 생성
  create: (title: string) => apiFetch<{
    id: number;
    title: string;
    music_object_key: string | null;
    music_duration_sec: string | null;
    music_bpm: string | null;
    created_at: string;
    updated_at: string;
  }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),
  
  // Edit State 로딩
  getEditState: (projectId: number) => apiFetch<{
    project: {
      id: number;
      title: string;
      music_object_key: string | null;
      music_duration_sec: string | null;
      music_bpm: string | null;
      created_at: string;
      updated_at: string;
    };
    tracks: Array<{
      id: number;
      slot: number;
      display_name: string | null;
      layers: Array<{
        id: number;
        skeleton_source_id: number;
        start_sec: string;
        end_sec: string;
        priority: number;
        label: string | null;
        source_status: string;
        source_object_key: string | null;
        source_fps: number | null;
        source_num_frames: number | null;
        source_num_joints: number | null;
      }>;
      keyframes: Array<{
        id: number;
        time_sec: string;
        x: string;
        y: string;
        interp: string;
      }>;
    }>;
  }>(`/projects/${projectId}/edit-state`),
};

// ============================================
// Music APIs
// ============================================

export const musicApi = {
  // 음악 파일 업로드 (multipart/form-data)
  upload: async (projectId: number, file: File, durationSec?: number, bpm?: number): Promise<{
    object_key: string;
    duration_sec: string | null;
    bpm: string | null;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (durationSec !== undefined) {
      formData.append('duration_sec', durationSec.toString());
    }
    if (bpm !== undefined) {
      formData.append('bpm', bpm.toString());
    }
    
    const url = `${API_BASE_URL}/projects/${projectId}/music/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Content-Type은 자동으로 multipart/form-data로 설정됨
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
};

// ============================================
// Layer APIs
// ============================================

// 레이어 응답 타입
interface LayerApiResponse {
  id: number;
  track_id: number;
  skeleton_source_id: number;
  start_sec: string;
  end_sec: string;
  priority: number;
  label: string | null;
  created_at: string;
  source_status: string;
  source_object_key: string | null;
  source_fps: number | null;
  source_num_frames: number | null;
  source_num_joints: number | null;
  source_error_message: string | null;
}

export const layerApi = {
  // 레이어 파일 업로드 (multipart/form-data)
  upload: async (
    trackId: number, 
    file: File, 
    startSec: number, 
    endSec: number, 
    priority?: number, 
    label?: string
  ): Promise<LayerApiResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('start_sec', startSec.toString());
    formData.append('end_sec', endSec.toString());
    if (priority !== undefined) {
      formData.append('priority', priority.toString());
    }
    if (label) {
      formData.append('label', label);
    }
    
    const url = `${API_BASE_URL}/tracks/${trackId}/layers/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
  
  // 레이어 조회
  get: (trackId: number, layerId: number) => 
    apiFetch<LayerApiResponse>(`/tracks/${trackId}/layers/${layerId}`),
  
  // 레이어 수정
  update: (trackId: number, layerId: number, data: {
    start_sec?: number;
    end_sec?: number;
    priority?: number;
    label?: string;
  }) => apiFetch<LayerApiResponse>(`/tracks/${trackId}/layers/${layerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  // 레이어 삭제
  delete: async (trackId: number, layerId: number): Promise<void> => {
    const url = `${API_BASE_URL}/tracks/${trackId}/layers/${layerId}`;
    const response = await fetch(url, { method: 'DELETE' });
    
    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }
  },
};

// ============================================
// Position Keyframes APIs
// ============================================

export const keyframeApi = {
  // 키프레임 조회
  get: (trackId: number) => apiFetch<Array<{
    id: number;
    track_id: number;
    time_sec: string;
    x: string;
    y: string;
    interp: string;
  }>>(`/tracks/${trackId}/position-keyframes`),
  
  // 키프레임 전체 교체 (upsert)
  update: (trackId: number, keyframes: Array<{
    time_sec: number;
    x: number;
    y: number;
    interp: 'STEP' | 'LINEAR';
  }>) => apiFetch<Array<{
    id: number;
    track_id: number;
    time_sec: string;
    x: string;
    y: string;
    interp: string;
  }>>(`/tracks/${trackId}/position-keyframes`, {
    method: 'PUT',
    body: JSON.stringify({ keyframes }),
  }),
};

// ============================================
// Assets APIs (Presigned URLs)
// ============================================

export const assetsApi = {
  // 단일 presigned URL 발급
  getPresignedUrl: (objectKey: string) => 
    apiFetch<{
      url: string;
      expires_in: number;
    }>('/assets/presign', {
      method: 'POST',
      body: JSON.stringify({ object_key: objectKey }),
    }),
  
  // 일괄 presigned URL 발급
  getPresignedUrlsBatch: (objectKeys: string[]) =>
    apiFetch<{
      urls: Record<string, string>;
      expires_in: number;
    }>('/assets/presign/batch', {
      method: 'POST',
      body: JSON.stringify({ object_keys: objectKeys }),
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

