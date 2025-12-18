import React, { useRef, useEffect, useMemo } from 'react';
import { SKELETON_CONNECTIONS, POSE_LANDMARKS, type SkeletonJson, type Keypoint } from '@/types';
import { TRACK_COLORS, type TrackSlot, type PositionKeyframe, type InterpType } from '@/types';

interface SkeletonRendererProps {
  skeletonData: SkeletonJson | null;
  currentTime: number;
  color?: string;
  showJoints?: boolean;
  showBones?: boolean;
  opacity?: number;
}

// 단일 스켈레톤 렌더링
export function SkeletonRenderer({
  skeletonData,
  currentTime,
  color = '#ffffff',
  showJoints = true,
  showBones = true,
  opacity = 1,
}: SkeletonRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 현재 시간에 해당하는 프레임 계산
  const currentFrame = useMemo(() => {
    if (!skeletonData) return null;
    
    const fps = skeletonData.meta.fps;
    const frameIdx = Math.floor(currentTime * fps);
    const clampedIdx = Math.min(frameIdx, skeletonData.frames.length - 1);
    
    return skeletonData.frames[clampedIdx] || null;
  }, [skeletonData, currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정 (고해상도 지원)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // 클리어
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!currentFrame.has_pose) {
      // 포즈 없음 표시
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No pose detected', rect.width / 2, rect.height / 2);
      return;
    }

    const keypoints = currentFrame.keypoints;
    
    // 좌표 변환 함수 (정규화된 좌표 → 캔버스 좌표)
    const toCanvas = (kp: Keypoint) => ({
      x: kp.x * rect.width,
      y: kp.y * rect.height,
      visibility: kp.visibility,
    });

    ctx.globalAlpha = opacity;

    // 본(뼈대) 그리기
    if (showBones) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = keypoints[startIdx];
        const end = keypoints[endIdx];
        
        // 둘 다 visibility가 0.5 이상일 때만 그리기
        if (start.visibility > 0.5 && end.visibility > 0.5) {
          const startPos = toCanvas(start);
          const endPos = toCanvas(end);
          
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(endPos.x, endPos.y);
          ctx.stroke();
        }
      });
    }

    // 관절점 그리기
    if (showJoints) {
      keypoints.forEach((kp, idx) => {
        if (kp.visibility > 0.5) {
          const pos = toCanvas(kp);
          
          // 주요 관절은 더 크게
          const isMainJoint = [
            POSE_LANDMARKS.NOSE,
            POSE_LANDMARKS.LEFT_SHOULDER,
            POSE_LANDMARKS.RIGHT_SHOULDER,
            POSE_LANDMARKS.LEFT_HIP,
            POSE_LANDMARKS.RIGHT_HIP,
            POSE_LANDMARKS.LEFT_WRIST,
            POSE_LANDMARKS.RIGHT_WRIST,
            POSE_LANDMARKS.LEFT_ANKLE,
            POSE_LANDMARKS.RIGHT_ANKLE,
          ].includes(idx);
          
          const radius = isMainJoint ? 4 : 2;
          
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      });
    }

    ctx.globalAlpha = 1;
  }, [currentFrame, color, showJoints, showBones, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}

// 멀티 댄서 Front View
interface FrontViewProps {
  dancers: Array<{
    slot: TrackSlot;
    skeletonData: SkeletonJson | null;
    localTime?: number; // 레이어 기준 로컬 시간 (옵션)
    offsetX?: number; // 댄서별 X 오프셋 (-1 ~ 1)
  }>;
  currentTime?: number; // 전역 시간 (localTime이 없을 때 사용)
}

export function FrontView({ dancers, currentTime = 0 }: FrontViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // 클리어 (어두운 배경)
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // 바닥 그리드 (선택적)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = rect.height * 0.9 - (i * rect.height * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // 각 댄서 렌더링
    dancers.forEach(({ slot, skeletonData, localTime, offsetX = 0 }) => {
      if (!skeletonData) return;

      const fps = skeletonData.meta.fps;
      // localTime이 있으면 사용, 없으면 전역 currentTime 사용
      const time = localTime ?? currentTime;
      const frameIdx = Math.floor(time * fps);
      const clampedIdx = Math.min(Math.max(0, frameIdx), skeletonData.frames.length - 1);
      const frame = skeletonData.frames[clampedIdx];

      if (!frame || !frame.has_pose) return;

      const keypoints = frame.keypoints;
      const color = TRACK_COLORS[slot];

      // 댄서별 오프셋 적용 (화면 3등분)
      const dancerWidth = rect.width / 3;
      const baseX = (slot - 1) * dancerWidth + dancerWidth / 2;

      // 좌표 변환 (스켈레톤 크기 조정 + 위치 오프셋)
      const toCanvas = (kp: Keypoint) => {
        // 스켈레톤 중심을 0.5로 가정하고 오프셋 적용
        const relativeX = (kp.x - 0.5) * dancerWidth * 0.8;
        return {
          x: baseX + relativeX + offsetX * dancerWidth * 0.3,
          y: kp.y * rect.height * 0.85 + rect.height * 0.05,
          visibility: kp.visibility,
        };
      };

      // 본 그리기
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;

      SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = keypoints[startIdx];
        const end = keypoints[endIdx];

        if (start.visibility > 0.5 && end.visibility > 0.5) {
          const startPos = toCanvas(start);
          const endPos = toCanvas(end);

          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(endPos.x, endPos.y);
          ctx.stroke();
        }
      });

      // 관절점 그리기
      ctx.globalAlpha = 1;
      keypoints.forEach((kp, idx) => {
        if (kp.visibility > 0.5) {
          const pos = toCanvas(kp);
          const isMainJoint = [
            POSE_LANDMARKS.NOSE,
            POSE_LANDMARKS.LEFT_SHOULDER,
            POSE_LANDMARKS.RIGHT_SHOULDER,
            POSE_LANDMARKS.LEFT_HIP,
            POSE_LANDMARKS.RIGHT_HIP,
          ].includes(idx);

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, isMainJoint ? 4 : 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      });

      // 댄서 라벨
      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Dancer ${slot}`, baseX, rect.height - 10);
    });

  }, [dancers, currentTime]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
      style={{ display: 'block' }}
    />
  );
}

// ============================================
// Top View (위에서 본 무대 배치도)
// ============================================

// 보간 함수
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 보간 타입에 따른 t 값 변환
function applyInterp(t: number, interp: InterpType): number {
  switch (interp) {
    case 'STEP':
      return 0; // step은 다음 키프레임 전까지 현재 값 유지
    case 'LINEAR':
    default:
      return t;
  }
}

// 키프레임 배열에서 현재 시간의 위치 계산
function interpolatePosition(
  keyframes: PositionKeyframe[],
  currentTime: number
): { x: number; y: number } | null {
  if (keyframes.length === 0) return null;
  
  // 시간순 정렬
  const sorted = [...keyframes].sort((a, b) => a.timeSec - b.timeSec);
  
  // 첫 키프레임 이전
  if (currentTime <= sorted[0].timeSec) {
    return { x: sorted[0].x, y: sorted[0].y };
  }
  
  // 마지막 키프레임 이후
  if (currentTime >= sorted[sorted.length - 1].timeSec) {
    const last = sorted[sorted.length - 1];
    return { x: last.x, y: last.y };
  }
  
  // 사이 구간 찾기
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    
    if (currentTime >= curr.timeSec && currentTime < next.timeSec) {
      const duration = next.timeSec - curr.timeSec;
      const elapsed = currentTime - curr.timeSec;
      const rawT = elapsed / duration;
      const t = applyInterp(rawT, curr.interp);
      
      return {
        x: lerp(curr.x, next.x, t),
        y: lerp(curr.y, next.y, t),
      };
    }
  }
  
  return null;
}

interface TopViewProps {
  dancers: Array<{
    slot: TrackSlot;
    positionKeyframes: PositionKeyframe[];
  }>;
  currentTime: number;
  showPaths?: boolean; // 동선 경로 표시
  showKeyframes?: boolean; // 키프레임 위치 표시
}

export function TopView({ 
  dancers, 
  currentTime, 
  showPaths = true,
  showKeyframes = true,
}: TopViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // 배경 (무대)
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, width, height);

    // 무대 영역 (패딩 적용)
    const padding = 20;
    const stageWidth = width - padding * 2;
    const stageHeight = height - padding * 2;
    const stageX = padding;
    const stageY = padding;

    // 무대 바닥
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(stageX, stageY, stageWidth, stageHeight);

    // 무대 테두리
    ctx.strokeStyle = '#333340';
    ctx.lineWidth = 2;
    ctx.strokeRect(stageX, stageY, stageWidth, stageHeight);

    // 그리드 (5x5)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      // 세로선
      const x = stageX + (stageWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, stageY);
      ctx.lineTo(x, stageY + stageHeight);
      ctx.stroke();
      
      // 가로선
      const y = stageY + (stageHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(stageX, y);
      ctx.lineTo(stageX + stageWidth, y);
      ctx.stroke();
    }

    // 중앙선 (더 밝게)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(stageX + stageWidth / 2, stageY);
    ctx.lineTo(stageX + stageWidth / 2, stageY + stageHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(stageX, stageY + stageHeight / 2);
    ctx.lineTo(stageX + stageWidth, stageY + stageHeight / 2);
    ctx.stroke();

    // 정규화 좌표 → 캔버스 좌표
    const toCanvas = (nx: number, ny: number) => ({
      x: stageX + nx * stageWidth,
      y: stageY + ny * stageHeight,
    });

    // 각 댄서 렌더링
    dancers.forEach(({ slot, positionKeyframes }) => {
      const color = TRACK_COLORS[slot];
      const sortedKeyframes = [...positionKeyframes].sort((a, b) => a.timeSec - b.timeSec);

      // 1. 동선 경로 그리기 (전체 경로)
      if (showPaths && sortedKeyframes.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        const firstPos = toCanvas(sortedKeyframes[0].x, sortedKeyframes[0].y);
        ctx.moveTo(firstPos.x, firstPos.y);
        
        for (let i = 1; i < sortedKeyframes.length; i++) {
          const pos = toCanvas(sortedKeyframes[i].x, sortedKeyframes[i].y);
          ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 2. 키프레임 위치 표시 (작은 원)
      if (showKeyframes) {
        sortedKeyframes.forEach((kf, idx) => {
          const pos = toCanvas(kf.x, kf.y);
          const isPast = kf.timeSec <= currentTime;
          
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = isPast ? color : 'transparent';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = isPast ? 0.6 : 0.3;
          ctx.fill();
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      }

      // 3. 현재 위치 계산 및 표시
      const currentPos = interpolatePosition(positionKeyframes, currentTime);
      if (currentPos) {
        const pos = toCanvas(currentPos.x, currentPos.y);
        
        // 그림자/글로우 효과
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        
        // 메인 원
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // 내부 원 (하이라이트)
        ctx.beginPath();
        ctx.arc(pos.x - 3, pos.y - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // 댄서 번호
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(slot), pos.x, pos.y);
      }
    });

    // 범례 (오른쪽 하단)
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    dancers.forEach(({ slot }, idx) => {
      const y = height - 15 - (dancers.length - 1 - idx) * 16;
      ctx.fillStyle = TRACK_COLORS[slot];
      ctx.beginPath();
      ctx.arc(width - 55, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`Dancer ${slot}`, width - 10, y + 3);
    });

    // "FRONT" 표시 (관객 방향)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ FRONT (관객)', width / 2, height - 5);

  }, [dancers, currentTime, showPaths, showKeyframes]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg"
      style={{ display: 'block' }}
    />
  );
}

export { interpolatePosition };
export default SkeletonRenderer;

