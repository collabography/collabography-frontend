/**
 * 프로젝트 관련 타입 정의
 * 백엔드 스펙 기반 (FastAPI + PostgreSQL + MinIO)
 */

// ============================================
// Enums
// ============================================

// 자산 상태
export type AssetStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

// 보간 타입 (Top View 키프레임)
export type InterpType = 'STEP' | 'LINEAR';

// 트랙 슬롯 (댄서 1~3)
export type TrackSlot = 1 | 2 | 3;

// 슬롯별 색상
export const TRACK_COLORS: Record<TrackSlot, string> = {
  1: '#f472b6', // Pink
  2: '#34d399', // Emerald  
  3: '#fbbf24', // Amber
};

// ============================================
// Skeleton Source (스켈레톤 JSON 자산 메타)
// ============================================

export interface SkeletonSource {
  sourceId: number;
  status: AssetStatus;
  objectKey: string | null;  // MinIO key (READY일 때만 존재)
  fps: number;
  numFrames: number;
  numJoints: number;
  poseModel: string | null;
  errorMessage?: string;
}

// ============================================
// Layer (타임라인 레이어/클립) - 편집의 핵심
// ============================================

export interface Layer {
  layerId: number;
  trackId: number;
  
  // 시간 범위
  startSec: number;
  endSec: number;
  
  // 우선순위 (클수록 위, 같은 시각에 겹칠 때 사용)
  priority: number;
  
  // 메타
  label: string | null;
  
  // 경계 안정화 (fade)
  fadeInSec: number;
  fadeOutSec: number;
  
  // 스켈레톤 소스 참조
  skeleton: SkeletonSource;
}

// ============================================
// Position Keyframe (Top View 동선)
// ============================================

/**
 * Position Keyframe
 * - STEP: 해당 위치에서 멈춤 (x, y 필수)
 * - LINEAR: 이전 STEP에서 다음 STEP으로 이동 구간 (x, y 불필요)
 */
export interface PositionKeyframe {
  id: number;
  timeSec: number;
  x?: number;    // STEP일 때만 필수
  y?: number;    // STEP일 때만 필수
  interp: InterpType;
}

// ============================================
// Track (댄서 트랙, 3개 고정 슬롯)
// ============================================

export interface Track {
  trackId: number;
  slot: TrackSlot;
  displayName: string | null;
  
  // 레이어 목록 (타임라인 클립들)
  layers: Layer[];
  
  // Top View 위치 키프레임
  positionKeyframes: PositionKeyframe[];
}

// ============================================
// Music (프로젝트당 1개)
// ============================================

export interface Music {
  objectKey: string | null;  // MinIO key
  durationSec: number;
  bpm: number | null;
}

// ============================================
// Project
// ============================================

export interface Project {
  id: number;
  title: string;
  music: Music;
  tracks: Track[];  // 항상 3개 (slot 1, 2, 3)
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// API Response Types
// ============================================

// 프로젝트 목록 아이템
export interface ProjectListItem {
  projectId: number;
  title: string;
  musicDurationSec: number | null;
  createdAt: string;
}

// 프로젝트 생성 응답
export interface CreateProjectResponse {
  projectId: number;
  tracks: Array<{
    trackId: number;
    slot: TrackSlot;
  }>;
}

// Edit State 응답 (Edit Page 진입 시 로딩)
export interface EditStateResponse {
  project: {
    id: number;
    title: string;
    music: Music;
  };
  tracks: Track[];
}

// 레이어 생성/수정 응답
export interface LayerResponse {
  layer: Layer;
}

// ============================================
// Upload Types
// ============================================

export type UploadKind = 'VIDEO' | 'SKELETON_JSON';

export interface UploadInitRequest {
  uploadKind: UploadKind;
  fileName: string;
  contentType: string;
}

export interface UploadInitResponse {
  uploadUrl: string;
  objectKey: string;
}

// ============================================
// Layer Creation Types
// ============================================

export interface CreateLayerInputVideo {
  kind: 'VIDEO';
  videoObjectKey: string;
}

export interface CreateLayerInputSkeleton {
  kind: 'SKELETON_JSON';
  skeletonObjectKey: string;
  fps: number;
  numFrames: number;
  numJoints: number;
  poseModel: string;
}

export type CreateLayerInput = CreateLayerInputVideo | CreateLayerInputSkeleton;

export interface CreateLayerRequest {
  label: string | null;
  startSec: number;
  endSec: number;
  priority: number;
  fadeInSec: number;
  fadeOutSec: number;
  input: CreateLayerInput;
}

// ============================================
// Layer Update Types
// ============================================

export interface UpdateLayerRequest {
  startSec?: number;
  endSec?: number;
  priority?: number;
  label?: string;
  fadeInSec?: number;
  fadeOutSec?: number;
}

// ============================================
// Position Keyframes Types
// ============================================

export interface UpdatePositionKeyframesRequest {
  keyframes: Array<{
    timeSec: number;
    x?: number;    // STEP일 때만 필수
    y?: number;    // STEP일 때만 필수
    interp: InterpType;
  }>;
}

// ============================================
// Helpers
// ============================================

// 트랙에서 특정 시간에 활성화된 레이어 찾기 (priority 최대)
export function getActiveLayerAtTime(track: Track, timeSec: number): Layer | null {
  const activeLayers = track.layers.filter(
    layer => layer.startSec <= timeSec && timeSec < layer.endSec
  );
  
  if (activeLayers.length === 0) return null;
  
  // priority가 가장 높은 레이어 반환
  return activeLayers.reduce((max, layer) => 
    layer.priority > max.priority ? layer : max
  );
}

// 레이어의 로컬 시간에서 프레임 인덱스 계산
export function getFrameIndexAtTime(layer: Layer, timeSec: number): number {
  const localTime = timeSec - layer.startSec;
  return Math.floor(localTime * layer.skeleton.fps);
}

// 트랙의 마지막 레이어 종료 시간
export function getTrackEndTime(track: Track): number {
  if (track.layers.length === 0) return 0;
  return Math.max(...track.layers.map(l => l.endSec));
}
