/**
 * 스켈레톤 데이터 타입 정의
 * MediaPipe Pose 모델 기반 (33개 관절 포인트)
 */

// 단일 키포인트 (관절)
export interface Keypoint {
  x: number;        // 0~1 정규화된 x 좌표
  y: number;        // 0~1 정규화된 y 좌표
  z: number;        // 깊이 값
  visibility: number; // 가시성 신뢰도 (0~1)
}

// 단일 프레임의 포즈 데이터
export interface PoseFrame {
  frame_idx: number;      // 원본 영상의 프레임 인덱스
  sample_idx: number;     // 샘플링된 인덱스
  time_sec: number;       // 시간 (초)
  has_pose: boolean;      // 포즈 감지 성공 여부
  keypoints: Keypoint[];  // 33개의 키포인트
  pose_vec?: number[];    // 플래튼된 포즈 벡터 (옵셔널)
  valid_mask?: number[];  // 각 키포인트의 유효성 (옵셔널)
}

// 스켈레톤 데이터 메타 정보
export interface SkeletonMeta {
  video_path: string;
  fps: number;
  num_frames_raw: number;
  num_frames_sampled: number;
  sample_stride: number;
  pose_model: string;
  num_joints: number;      // 33 for MediaPipe
}

// 세그먼트에 포함된 전체 스켈레톤 데이터
export interface SkeletonData {
  meta: SkeletonMeta;
  frames: PoseFrame[];
}

/**
 * MediaPipe Pose 관절 인덱스 맵핑
 * 스켈레톤 렌더링 시 사용
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * 스켈레톤 렌더링을 위한 본(bone) 연결 정의
 */
export const SKELETON_CONNECTIONS: [number, number][] = [
  // 몸통
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  
  // 왼팔
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  
  // 오른팔
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  
  // 왼다리
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  
  // 오른다리
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  
  // 얼굴 (간소화)
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.NOSE],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.NOSE],
];

