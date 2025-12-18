import type { SkeletonData } from './skeleton';

/**
 * 프로젝트 관련 타입 정의
 */

// 댄서 ID (1, 2, 3으로 제한)
export type DancerId = 1 | 2 | 3;

// 댄서별 색상
export const DANCER_COLORS: Record<DancerId, string> = {
  1: '#f472b6', // Pink
  2: '#34d399', // Emerald
  3: '#fbbf24', // Amber
};

// 세그먼트: 특정 시간 구간의 춤 영상 데이터
export interface Segment {
  id: string;
  name: string;
  startTime: number;      // 타임라인 상의 시작 시간 (초)
  duration: number;       // 세그먼트 길이 (초)
  skeletonData: SkeletonData | null; // 스켈레톤 데이터 (변환 완료 시)
  videoUrl?: string;      // 원본 영상 URL (옵셔널)
  isProcessing: boolean;  // 스켈레톤 추출 중 여부
}

// 트랙: 한 명의 댄서의 movement
export interface Track {
  id: string;
  dancerId: DancerId;
  segments: Segment[];
}

// Top View에서의 댄서 위치 (타임라인 시간별)
export interface DancerPosition {
  time: number;   // 타임라인 시간 (초)
  x: number;      // Top View X 좌표 (-1 ~ 1)
  y: number;      // Top View Y 좌표 (-1 ~ 1, 무대 앞뒤)
}

// 댄서 정보
export interface Dancer {
  id: DancerId;
  name: string;
  track: Track;
  positions: DancerPosition[]; // 시간별 위치 키프레임
}

// 프로젝트: 하나의 군무 단위
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  // 음악
  musicUrl: string | null;
  musicDuration: number;      // 전체 타임라인 길이 (초)
  musicName: string | null;
  
  // 댄서들
  dancers: Dancer[];
  
  // 현재 재생 상태
  currentTime: number;
  isPlaying: boolean;
}

// 프로젝트 목록용 요약 정보
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  musicName: string | null;
  dancerCount: number;
  thumbnailUrl?: string;
}

// 새 프로젝트 생성 시 입력값
export interface CreateProjectInput {
  name: string;
  musicFile: File;
}

