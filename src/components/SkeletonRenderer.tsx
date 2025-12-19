import { useRef, useEffect, useMemo, useState } from 'react';
import { 
  getSkeletonConnections, 
  getMainJointIndices, 
  type SkeletonJson, 
  type Keypoint 
} from '@/types';
import { TRACK_COLORS, type TrackSlot, type PositionKeyframe } from '@/types';

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

      const connections = getSkeletonConnections(skeletonData?.meta?.num_joints ?? 33);
      connections.forEach(([startIdx, endIdx]) => {
        const start = keypoints[startIdx];
        const end = keypoints[endIdx];
        
        // 둘 다 존재하고 visibility가 0.5 이상일 때만 그리기
        if (start && end && start.visibility > 0.5 && end.visibility > 0.5) {
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
      const mainJoints = getMainJointIndices(skeletonData?.meta?.num_joints ?? 33);
      keypoints.forEach((kp, idx) => {
        if (kp && kp.visibility > 0.5) {
          const pos = toCanvas(kp);
          
          // 주요 관절은 더 크게
          const isMainJoint = mainJoints.includes(idx);
          
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

// 멀티 댄서 Front View (Top View 위치 반영)
interface FrontViewProps {
  dancers: Array<{
    slot: TrackSlot;
    skeletonData: SkeletonJson | null;
    localTime?: number; // 레이어 기준 로컬 시간 (옵션)
    offsetX?: number; // 댄서별 X 오프셋 (-1 ~ 1) - deprecated, use topViewPosition
    topViewPosition?: { x: number; y: number } | null; // Top View에서의 위치 (0~1)
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

    // Top View y좌표 기준으로 정렬 (y가 작을수록 = 무대 뒤쪽 = 먼저 그림)
    // 이렇게 하면 앞에 있는 댄서가 뒤에 있는 댄서를 가림
    const sortedDancers = [...dancers].sort((a, b) => {
      const aY = a.topViewPosition?.y ?? 0.5;
      const bY = b.topViewPosition?.y ?? 0.5;
      return aY - bY; // y가 작은 것(뒤쪽)부터 먼저 그림
    });

    // 각 댄서 렌더링
    sortedDancers.forEach(({ slot, skeletonData, localTime, topViewPosition }) => {
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

      // ============================================
      // Top View 위치 기반 Front View 매핑
      // ============================================
      
      // Top View 위치 (기본값: 중앙)
      const tvX = topViewPosition?.x ?? 0.5; // 0=왼쪽, 1=오른쪽
      const tvY = topViewPosition?.y ?? 0.5; // 0=무대 뒤쪽, 1=무대 앞쪽(관객 가까움)
      
      // Front View에서의 X 위치 (Top View x 그대로 사용)
      // tvX: 0 → 화면 왼쪽, tvX: 1 → 화면 오른쪽
      const frontX = tvX * rect.width;
      
      // Front View에서의 크기 (Top View y에 따라)
      // tvY: 0 (뒤) → 작게 (0.5배), tvY: 1 (앞) → 크게 (1.2배)
      const minScale = 0.5;
      const maxScale = 1.2;
      const scale = minScale + (maxScale - minScale) * tvY;
      
      // 스켈레톤 기본 너비 (화면의 30%)
      const baseSkeletonWidth = rect.width * 0.3;
      const skeletonWidth = baseSkeletonWidth * scale;
      
      // Y 오프셋 (뒤에 있을수록 위로)
      // tvY: 0 (뒤) → 화면 위쪽, tvY: 1 (앞) → 화면 아래쪽
      const yOffset = (1 - tvY) * rect.height * 0.15;

      // 좌표 변환 (스켈레톤 크기 조정 + 위치)
      const toCanvas = (kp: Keypoint) => {
        // 스켈레톤 중심을 0.5로 가정
        const relativeX = (kp.x - 0.5) * skeletonWidth;
        const relativeY = kp.y * rect.height * 0.75 * scale;
        
        return {
          x: frontX + relativeX,
          y: relativeY + rect.height * 0.05 + yOffset,
          visibility: kp.visibility,
        };
      };

      // 투명도 (뒤에 있을수록 약간 투명)
      const opacity = 0.7 + 0.3 * tvY;

      // 본 그리기
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = 'round';
      ctx.globalAlpha = opacity * 0.9;

      const connections = getSkeletonConnections(skeletonData?.meta?.num_joints ?? 33);
      connections.forEach(([startIdx, endIdx]) => {
        const start = keypoints[startIdx];
        const end = keypoints[endIdx];

        if (start && end && start.visibility > 0.5 && end.visibility > 0.5) {
          const startPos = toCanvas(start);
          const endPos = toCanvas(end);

          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(endPos.x, endPos.y);
          ctx.stroke();
        }
      });

      // 관절점 그리기
      ctx.globalAlpha = opacity;
      const mainJoints = getMainJointIndices(skeletonData?.meta?.num_joints ?? 33);
      keypoints.forEach((kp, idx) => {
        if (kp && kp.visibility > 0.5) {
          const pos = toCanvas(kp);
          const isMainJoint = mainJoints.includes(idx);

          const jointRadius = (isMainJoint ? 4 : 2) * scale;
          
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, jointRadius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      });

      // 댄서 라벨 (스켈레톤 아래)
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(12 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      const labelY = rect.height * 0.85 * scale + rect.height * 0.05 + yOffset + 15;
      ctx.fillText(`Dancer ${slot}`, frontX, Math.min(labelY, rect.height - 5));
    });
    
    ctx.globalAlpha = 1;

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

/**
 * 새로운 보간 로직:
 * - STEP: 해당 위치(x, y)에서 멈춤
 * - LINEAR: 이전 STEP에서 다음 STEP으로 이동 중 (x, y 없음)
 * 
 * 예시:
 *   [STEP 0초 (0.2, 0.7)] → [LINEAR 1초] → [STEP 2초 (0.5, 0.5)]
 *   - 0~1초: (0.2, 0.7)에서 머무름
 *   - 1~2초: (0.2, 0.7) → (0.5, 0.5) 선형 이동
 *   - 2초~: (0.5, 0.5)에서 머무름
 */
function interpolatePosition(
  keyframes: PositionKeyframe[],
  currentTime: number
): { x: number; y: number } | null {
  if (keyframes.length === 0) return null;
  
  // 시간순 정렬
  const sorted = [...keyframes].sort((a, b) => a.timeSec - b.timeSec);
  
  // STEP 키프레임만 추출 (위치 정보 있는 것들)
  const stepKeyframes = sorted.filter(
    (kf): kf is PositionKeyframe & { x: number; y: number } => 
      kf.interp === 'STEP' && kf.x !== undefined && kf.y !== undefined
  );
  
  if (stepKeyframes.length === 0) return null;
  
  // 첫 STEP 이전
  if (currentTime <= stepKeyframes[0].timeSec) {
    return { x: stepKeyframes[0].x, y: stepKeyframes[0].y };
  }
  
  // 마지막 STEP 이후
  if (currentTime >= stepKeyframes[stepKeyframes.length - 1].timeSec) {
    const last = stepKeyframes[stepKeyframes.length - 1];
    return { x: last.x, y: last.y };
  }
  
  // 현재 시간이 어느 STEP 사이에 있는지 찾기
  for (let i = 0; i < stepKeyframes.length - 1; i++) {
    const currStep = stepKeyframes[i];
    const nextStep = stepKeyframes[i + 1];
    
    if (currentTime >= currStep.timeSec && currentTime < nextStep.timeSec) {
      // 이 구간에 LINEAR 키프레임이 있는지 확인
      const linearInBetween = sorted.find(
        kf => kf.interp === 'LINEAR' && 
              kf.timeSec > currStep.timeSec && 
              kf.timeSec <= nextStep.timeSec
      );
      
      if (linearInBetween && currentTime >= linearInBetween.timeSec) {
        // LINEAR 구간: 이동 중
        const moveDuration = nextStep.timeSec - linearInBetween.timeSec;
        const moveElapsed = currentTime - linearInBetween.timeSec;
        const t = moveDuration > 0 ? moveElapsed / moveDuration : 0;
        
        return {
          x: lerp(currStep.x, nextStep.x, Math.min(1, t)),
          y: lerp(currStep.y, nextStep.y, Math.min(1, t)),
        };
      } else {
        // STEP 구간: 현재 위치에서 머무름
        return { x: currStep.x, y: currStep.y };
      }
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
      
      // STEP 키프레임만 추출 (위치 정보 있는 것들만 그리기)
      const stepKeyframes = sortedKeyframes.filter(
        (kf): kf is typeof kf & { x: number; y: number } => 
          kf.interp === 'STEP' && kf.x !== undefined && kf.y !== undefined
      );

      // 1. 동선 경로 그리기 (STEP 위치들만 연결)
      if (showPaths && stepKeyframes.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        const firstPos = toCanvas(stepKeyframes[0].x, stepKeyframes[0].y);
        ctx.moveTo(firstPos.x, firstPos.y);
        
        for (let i = 1; i < stepKeyframes.length; i++) {
          const pos = toCanvas(stepKeyframes[i].x, stepKeyframes[i].y);
          ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 2. 키프레임 위치 표시 (STEP만 작은 원으로 표시)
      if (showKeyframes) {
        stepKeyframes.forEach((kf) => {
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

// ============================================
// Top View Editor (편집 모드 지원)
// ============================================

type TopViewMode = 'play' | 'edit';

interface DancerEditPosition {
  slot: TrackSlot;
  x: number;
  y: number;
  hasExistingKeyframe: boolean; // 해당 시간에 기존 키프레임 있는지
}

interface TopViewEditorProps {
  dancers: Array<{
    slot: TrackSlot;
    positionKeyframes: PositionKeyframe[];
  }>;
  currentTime: number;
  mode: TopViewMode;
  onModeChange: (mode: TopViewMode) => void;
  onSavePositions: (positions: Array<{ slot: TrackSlot; x: number; y: number }>) => void;
  showPaths?: boolean;
  showKeyframes?: boolean;
}

export function TopViewEditor({
  dancers,
  currentTime,
  mode,
  onModeChange,
  onSavePositions,
  showPaths = true,
  showKeyframes = true,
}: TopViewEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 편집 중인 댄서 위치 상태
  const [editPositions, setEditPositions] = useState<DancerEditPosition[]>([]);
  
  // 드래그 상태
  const dragRef = useRef<{
    slot: TrackSlot;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // 현재 시간에 해당하는 각 댄서의 위치 계산 (기존 키프레임 or 보간)
  const getCurrentPositions = useMemo((): DancerEditPosition[] => {
    return dancers.map(({ slot, positionKeyframes }) => {
      // 현재 시간에 정확히 일치하는 STEP 키프레임이 있는지 확인
      const existingKeyframe = positionKeyframes.find(
        kf => kf.interp === 'STEP' && 
              Math.abs(kf.timeSec - currentTime) < 0.01 &&
              kf.x !== undefined && kf.y !== undefined
      );
      
      if (existingKeyframe && existingKeyframe.x !== undefined && existingKeyframe.y !== undefined) {
        return {
          slot,
          x: existingKeyframe.x,
          y: existingKeyframe.y,
          hasExistingKeyframe: true,
        };
      }
      
      // 기존 키프레임 없으면 보간된 위치 사용
      const interpolated = interpolatePosition(positionKeyframes, currentTime);
      return {
        slot,
        x: interpolated?.x ?? 0.5,
        y: interpolated?.y ?? 0.5,
        hasExistingKeyframe: false,
      };
    });
  }, [dancers, currentTime]);

  // 편집 모드 진입 시 현재 위치로 초기화
  useEffect(() => {
    if (mode === 'edit') {
      setEditPositions(getCurrentPositions);
    }
  }, [mode, getCurrentPositions]);

  // 캔버스 및 무대 영역 계산
  const getStageGeometry = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const padding = 20;
    return {
      width: rect.width,
      height: rect.height,
      stageX: padding,
      stageY: padding,
      stageWidth: rect.width - padding * 2,
      stageHeight: rect.height - padding * 2,
    };
  };

  // 정규화 좌표 → 캔버스 좌표
  const normalizedToCanvas = (nx: number, ny: number) => {
    const geo = getStageGeometry();
    if (!geo) return { x: 0, y: 0 };
    
    return {
      x: geo.stageX + nx * geo.stageWidth,
      y: geo.stageY + ny * geo.stageHeight,
    };
  };

  // 마우스 좌표에서 댄서 찾기
  const findDancerAtPosition = (canvasX: number, canvasY: number): TrackSlot | null => {
    const positions = mode === 'edit' ? editPositions : getCurrentPositions;
    
    for (const pos of positions) {
      const dancerCanvasPos = normalizedToCanvas(pos.x, pos.y);
      const dx = canvasX - dancerCanvasPos.x;
      const dy = canvasY - dancerCanvasPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 15) { // 15px 반경 내
        return pos.slot;
      }
    }
    return null;
  };

  // 마우스 이벤트 핸들러 (편집 모드)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const slot = findDancerAtPosition(canvasX, canvasY);
    if (slot) {
      const pos = editPositions.find(p => p.slot === slot);
      if (pos) {
        dragRef.current = {
          slot,
          startX: e.clientX,
          startY: e.clientY,
          startPosX: pos.x,
          startPosY: pos.y,
        };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'edit' || !dragRef.current) return;
    
    const geo = getStageGeometry();
    if (!geo) return;
    
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    const newX = Math.max(0, Math.min(1, dragRef.current.startPosX + deltaX / geo.stageWidth));
    const newY = Math.max(0, Math.min(1, dragRef.current.startPosY + deltaY / geo.stageHeight));
    
    setEditPositions(prev => prev.map(p => 
      p.slot === dragRef.current?.slot 
        ? { ...p, x: newX, y: newY }
        : p
    ));
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
  };

  // 저장 핸들러
  const handleSave = () => {
    onSavePositions(editPositions.map(({ slot, x, y }) => ({ slot, x, y })));
    onModeChange('play');
  };

  // 취소 핸들러
  const handleCancel = () => {
    setEditPositions(getCurrentPositions);
    onModeChange('play');
  };

  // 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // 배경
    ctx.fillStyle = mode === 'edit' ? '#12121a' : '#0f0f14';
    ctx.fillRect(0, 0, width, height);

    // 무대 영역
    const padding = 20;
    const stageWidth = width - padding * 2;
    const stageHeight = height - padding * 2;
    const stageX = padding;
    const stageY = padding;

    // 무대 바닥
    ctx.fillStyle = mode === 'edit' ? '#1e1e2a' : '#1a1a24';
    ctx.fillRect(stageX, stageY, stageWidth, stageHeight);

    // 무대 테두리
    ctx.strokeStyle = mode === 'edit' ? '#4a4a5a' : '#333340';
    ctx.lineWidth = mode === 'edit' ? 3 : 2;
    ctx.strokeRect(stageX, stageY, stageWidth, stageHeight);

    // 그리드
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const x = stageX + (stageWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, stageY);
      ctx.lineTo(x, stageY + stageHeight);
      ctx.stroke();
      
      const y = stageY + (stageHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(stageX, y);
      ctx.lineTo(stageX + stageWidth, y);
      ctx.stroke();
    }

    // 중앙선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(stageX + stageWidth / 2, stageY);
    ctx.lineTo(stageX + stageWidth / 2, stageY + stageHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(stageX, stageY + stageHeight / 2);
    ctx.lineTo(stageX + stageWidth, stageY + stageHeight / 2);
    ctx.stroke();

    const toCanvas = (nx: number, ny: number) => ({
      x: stageX + nx * stageWidth,
      y: stageY + ny * stageHeight,
    });

    // 재생 모드: 기존 TopView와 동일
    if (mode === 'play') {
      dancers.forEach(({ slot, positionKeyframes }) => {
        const color = TRACK_COLORS[slot];
        const sortedKeyframes = [...positionKeyframes].sort((a, b) => a.timeSec - b.timeSec);
        
        const stepKeyframes = sortedKeyframes.filter(
          (kf): kf is typeof kf & { x: number; y: number } => 
            kf.interp === 'STEP' && kf.x !== undefined && kf.y !== undefined
        );

        // 경로
        if (showPaths && stepKeyframes.length > 1) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([4, 4]);
          
          ctx.beginPath();
          const firstPos = toCanvas(stepKeyframes[0].x, stepKeyframes[0].y);
          ctx.moveTo(firstPos.x, firstPos.y);
          
          for (let i = 1; i < stepKeyframes.length; i++) {
            const pos = toCanvas(stepKeyframes[i].x, stepKeyframes[i].y);
            ctx.lineTo(pos.x, pos.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // 키프레임 위치
        if (showKeyframes) {
          stepKeyframes.forEach((kf) => {
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

        // 현재 위치
        const currentPos = interpolatePosition(positionKeyframes, currentTime);
        if (currentPos) {
          const pos = toCanvas(currentPos.x, currentPos.y);
          
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(pos.x - 3, pos.y - 3, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fill();
          
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = '#000';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(slot), pos.x, pos.y);
        }
      });
    }
    
    // 편집 모드: 드래그 가능한 댄서 표시
    if (mode === 'edit') {
      editPositions.forEach(({ slot, x, y, hasExistingKeyframe }) => {
        const color = TRACK_COLORS[slot];
        const pos = toCanvas(x, y);
        
        // 드래그 영역 표시 (외부 원)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 글로우 효과
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        
        // 메인 원
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // 기존 키프레임 있으면 표시
        if (hasExistingKeyframe) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        
        // 댄서 번호
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(slot), pos.x, pos.y);
        
        // "drag" 힌트
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '8px sans-serif';
        ctx.fillText('drag', pos.x, pos.y + 24);
      });
    }

    // 범례
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

    // FRONT 표시
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ FRONT (관객)', width / 2, height - 5);

  }, [dancers, currentTime, mode, editPositions, showPaths, showKeyframes]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* 툴바 */}
      <div className="flex-shrink-0 h-10 bg-surface-800 border-b border-surface-700 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-400">
            {mode === 'play' ? '재생 모드' : '편집 모드'}
          </span>
          {mode === 'edit' && (
            <span className="text-xs text-accent-400">
              @ {currentTime.toFixed(2)}s
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {mode === 'play' ? (
            <button
              onClick={() => onModeChange('edit')}
              className="px-3 py-1 text-xs bg-accent-600 hover:bg-accent-500 text-white rounded transition-colors"
            >
              위치 편집
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-xs bg-surface-600 hover:bg-surface-500 text-surface-200 rounded transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              >
                저장
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 캔버스 */}
      <div className="flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-b-lg"
          style={{ 
            display: 'block',
            cursor: mode === 'edit' ? 'crosshair' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}

export { interpolatePosition };
export default SkeletonRenderer;

