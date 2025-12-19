import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipBack, Square, Video, FileJson, Layers, Save, Loader2, Check, ChevronsUp, ChevronUp, ChevronsDown, ChevronDown, Trash2 } from 'lucide-react';
import { Button, FrontView, TopViewEditor, interpolatePosition } from '@/components';
import { useProjectStore, useCurrentProject, useCurrentTime, useIsPlaying } from '@/stores';
import { cn, formatTimeWithMs, formatTime } from '@/lib/utils';
import { projectApi, layerApi, keyframeApi, assetsApi } from '@/lib/api';
import { TRACK_COLORS, type TrackSlot, type Track, type Layer, type SkeletonJson, type Project, type AssetStatus, type InterpType } from '@/types';

// ============================================
// Layer Context Menu
// ============================================

interface LayerContextMenuProps {
  x: number;
  y: number;
  layer: Layer;
  onClose: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendToBack: () => void;
  onSendBackward: () => void;
  onDelete: () => void;
}

function LayerContextMenu({
  x,
  y,
  layer,
  onClose,
  onBringToFront,
  onBringForward,
  onSendToBack,
  onSendBackward,
  onDelete,
}: LayerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 메뉴가 화면 밖으로 나가지 않도록 조정
  const adjustedPosition = useMemo(() => {
    const menuWidth = 200;
    const menuHeight = 320; // 삭제 버튼까지 포함한 높이
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    return { x: adjustedX, y: adjustedY };
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface-800 border border-surface-600 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* 헤더: 레이어 이름 */}
      <div className="px-3 py-2 border-b border-surface-700">
        <p className="text-xs text-surface-400">레이어</p>
        <p className="text-sm text-white font-medium truncate">
          {layer.label || `Layer ${layer.layerId}`}
        </p>
        <p className="text-xs text-surface-500 mt-0.5">
          Priority: {layer.priority}
        </p>
      </div>

      {/* 메뉴 아이템들 */}
      <div className="py-1">
        {/* 정렬 관련 메뉴 */}
        <button
          onClick={() => { onBringToFront(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-surface-700 text-surface-200 hover:text-white"
        >
          <ChevronsUp className="w-4 h-4" />
          <span>맨 앞으로 가져오기</span>
        </button>
        <button
          onClick={() => { onBringForward(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-surface-700 text-surface-200 hover:text-white"
        >
          <ChevronUp className="w-4 h-4" />
          <span>앞으로 가져오기</span>
        </button>
        <button
          onClick={() => { onSendBackward(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-surface-700 text-surface-200 hover:text-white"
        >
          <ChevronDown className="w-4 h-4" />
          <span>뒤로 보내기</span>
        </button>
        <button
          onClick={() => { onSendToBack(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-surface-700 text-surface-200 hover:text-white"
        >
          <ChevronsDown className="w-4 h-4" />
          <span>맨 뒤로 보내기</span>
        </button>
        
        {/* 구분선 */}
        <div className="my-1 border-t border-surface-700" />
        
        {/* 삭제 */}
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-surface-700 text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-4 h-4" />
          <span>삭제</span>
        </button>
      </div>
    </div>
  );
}

// 타임라인 줌 설정
const MIN_PIXELS_PER_SECOND = 10;  // 최소 줌 (축소)
const MAX_PIXELS_PER_SECOND = 200; // 최대 줌 (확대)
const DEFAULT_PIXELS_PER_SECOND = 50;

// ============================================
// Placeholder Components
// ============================================

function FrontViewPlaceholder() {
  return (
    <div className="h-full bg-surface-900 rounded-lg border border-surface-700 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center gap-6 mb-4">
          {([1, 2, 3] as TrackSlot[]).map((slot) => (
            <div key={slot} className="flex flex-col items-center gap-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: TRACK_COLORS[slot] }}
              />
              <div
                className="w-0.5 h-10"
                style={{ backgroundColor: TRACK_COLORS[slot] }}
              />
            </div>
          ))}
        </div>
        <p className="text-surface-400 text-sm">Front View</p>
        <p className="text-surface-500 text-xs mt-1">스켈레톤 렌더링</p>
      </div>
    </div>
  );
}

// ============================================
// Timeline Components
// ============================================

// 타임라인 눈금자 (내용 영역만) + 드래그 줌
const FPS = 24;

function TimelineRulerContent({ 
  duration, 
  pixelsPerSecond,
  currentTime,
  onZoom,
  onSeek,
}: { 
  duration: number;
  pixelsPerSecond: number;
  currentTime: number;
  onZoom: (delta: number) => void;
  onSeek: (time: number) => void;
}) {
  const totalWidth = duration * pixelsPerSecond;
  const rulerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startPPS: number; isDragging: boolean } | null>(null);
  
  // 줌 레벨에 따라 눈금 간격 조정
  const majorInterval = pixelsPerSecond < 30 ? 10 : pixelsPerSecond < 80 ? 5 : 2;
  const minorInterval = pixelsPerSecond < 30 ? 5 : 1;
  
  // 프레임 눈금 표시 여부 (충분히 확대했을 때만)
  const showFrameTicks = pixelsPerSecond >= 100;
  // 프레임 라벨 표시 여부 (더 확대했을 때)
  const showFrameLabels = pixelsPerSecond >= 150;
  
  const majorTicks: number[] = [];
  const minorTicks: number[] = [];
  
  for (let t = 0; t <= duration; t += minorInterval) {
    if (t % majorInterval === 0) {
      majorTicks.push(t);
    } else {
      minorTicks.push(t);
    }
  }

  // 프레임 눈금 계산 (보이는 영역 최적화를 위해 useMemo 사용)
  const frameTicks = useMemo(() => {
    if (!showFrameTicks) return [];
    
    const ticks: Array<{ time: number; frame: number; isKeyFrame: boolean }> = [];
    const totalFrames = Math.ceil(duration * FPS);
    
    for (let f = 0; f <= totalFrames; f++) {
      const time = f / FPS;
      // 초 단위 눈금과 겹치지 않게 (정수 초는 제외)
      if (Math.abs(time - Math.round(time)) < 0.001) continue;
      
      ticks.push({
        time,
        frame: f % FPS, // 해당 초 내에서의 프레임 번호 (0-23)
        isKeyFrame: f % 6 === 0, // 6프레임마다 강조 (4등분)
      });
    }
    return ticks;
  }, [duration, showFrameTicks]);

  // 드래그로 줌 조절, 클릭으로 시간 이동
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 왼쪽 클릭만
    dragRef.current = { startX: e.clientX, startPPS: pixelsPerSecond, isDragging: false };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      
      // 5px 이상 움직이면 드래그로 판정
      if (Math.abs(deltaX) > 5) {
        dragRef.current.isDragging = true;
        onZoom(deltaX * 0.5);
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      // 드래그가 아니었으면 클릭으로 처리 (시간 이동)
      if (dragRef.current && !dragRef.current.isDragging && rulerRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        const x = upEvent.clientX - rect.left;
        const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
        onSeek(time);
      }
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      ref={rulerRef}
      className="h-8 bg-surface-900/30 relative cursor-pointer select-none"
      style={{ width: totalWidth }}
      onMouseDown={handleMouseDown}
      title="클릭: 시간 이동 / 드래그: 줌 조절"
    >
      {/* 프레임 눈금 (가장 아래 레이어) */}
      {frameTicks.map(({ time, frame, isKeyFrame }) => (
        <div
          key={`frame-${time.toFixed(4)}`}
          className="absolute top-0 pointer-events-none flex flex-col items-center"
          style={{ left: time * pixelsPerSecond }}
        >
          <div 
            className={cn(
              'w-px',
              isKeyFrame ? 'h-2 bg-accent-600/50' : 'h-1 bg-surface-700'
            )}
          />
          {showFrameLabels && isKeyFrame && (
            <span className="text-[8px] text-accent-600/60 font-mono">
              {frame}
            </span>
          )}
        </div>
      ))}
      
      {/* 초 단위 보조 눈금 */}
      {minorTicks.map((t) => (
        <div
          key={`minor-${t}`}
          className="absolute top-0 w-px h-2 bg-surface-600 pointer-events-none"
          style={{ left: t * pixelsPerSecond }}
        />
      ))}
      
      {/* 초 단위 주요 눈금 */}
      {majorTicks.map((t) => (
        <div
          key={`major-${t}`}
          className="absolute top-0 flex flex-col items-start pointer-events-none"
          style={{ left: t * pixelsPerSecond }}
        >
          <div className="w-px h-4 bg-surface-500" />
          <span className="text-[10px] text-surface-500 font-mono ml-1 whitespace-nowrap">
            {formatTime(t)}
          </span>
        </div>
      ))}
      
      {/* Playhead (현재 시간 표시) */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
        style={{ left: currentTime * pixelsPerSecond }}
      >
        <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
      </div>
    </div>
  );
}

// Playhead 컴포넌트 (타임라인 전체에 걸친 세로선)
function Playhead({ currentTime, pixelsPerSecond }: { currentTime: number; pixelsPerSecond: number }) {
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
      style={{ left: currentTime * pixelsPerSecond }}
    />
  );
}

// 프레임 스냅 유틸리티
const SNAP_FPS = 24;
const snapToFrame = (timeSec: number): number => {
  const frame = Math.round(timeSec * SNAP_FPS);
  return frame / SNAP_FPS;
};

// 레이어 블록 컴포넌트 (드래그 가능 + 컨텍스트 메뉴)
function LayerBlock({ 
  layer, 
  color, 
  pixelsPerSecond,
  onDragMove,
  isPatch = false,
  onContextMenu,
}: { 
  layer: Layer; 
  color: string; 
  pixelsPerSecond: number;
  onDragMove?: (layerId: number, newStartSec: number) => void;
  isPatch?: boolean;
  onContextMenu?: (e: React.MouseEvent, layer: Layer) => void;
}) {
  const width = (layer.endSec - layer.startSec) * pixelsPerSecond;
  const left = layer.startSec * pixelsPerSecond;
  const isProcessing = layer.skeleton.status === 'PROCESSING';
  const isFailed = layer.skeleton.status === 'FAILED';
  
  const dragRef = useRef<{ startX: number; startLeft: number; currentLeft: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState(left);

  // left 변경 시 dragLeft 동기화
  useEffect(() => {
    if (!isDragging) {
      setDragLeft(left);
    }
  }, [left, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 우클릭은 드래그하지 않음
    if (e.button === 2) return;
    if (!onDragMove) return;
    e.preventDefault();
    e.stopPropagation();
    
    dragRef.current = {
      startX: e.clientX,
      startLeft: left,
      currentLeft: left,
    };
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const newLeft = Math.max(0, dragRef.current.startLeft + deltaX);
      dragRef.current.currentLeft = newLeft; // ref에 최신값 저장
      setDragLeft(newLeft);
    };
    
    const handleMouseUp = () => {
      if (dragRef.current && onDragMove) {
        // ref에서 최신값 가져와서 프레임 스냅 적용
        const newStartSec = snapToFrame(dragRef.current.currentLeft / pixelsPerSecond);
        onDragMove(layer.layerId, newStartSec);
      }
      dragRef.current = null;
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 우클릭 핸들러
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, layer);
  };

  // 드래그 중일 때 스냅 프리뷰
  const snappedLeft = isDragging 
    ? snapToFrame(dragLeft / pixelsPerSecond) * pixelsPerSecond 
    : left;

  // 패치 레벨 표시 (몇 번째 패치인지)
  const patchLevel = isPatch ? layer.priority - PATCH_PRIORITY_THRESHOLD : 0;

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 rounded',
        'border flex items-center px-2 overflow-hidden',
        'hover:brightness-110 transition-all',
        isProcessing && 'animate-pulse',
        isFailed && 'opacity-50',
        onDragMove ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'cursor-grabbing z-30',
        isPatch && 'border-2'
      )}
      style={{
        left: isDragging ? dragLeft : snappedLeft,
        width: Math.max(width, 20),
        backgroundColor: isPatch ? color : `${color}30`, // 패치는 100% 불투명
        borderColor: isFailed ? '#ef4444' : isPatch ? '#fff' : color,
        boxShadow: isPatch ? `0 0 ${8 + patchLevel * 4}px ${color}` : undefined,
        zIndex: isPatch ? 10 + patchLevel : 1,
      }}
      title={`${layer.label || 'Layer'} (${(layer.endSec - layer.startSec).toFixed(1)}s) - Priority: ${layer.priority}${isPatch ? ` [패치 #${patchLevel}]` : ''}`}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {isPatch && (
        <span 
          className="text-[10px] px-1 rounded mr-1 font-bold text-white flex-shrink-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          P{patchLevel}
        </span>
      )}
      <span 
        className={cn(
          'text-xs font-medium truncate',
          isPatch && 'text-white drop-shadow-md'
        )}
        style={{ color: isFailed ? '#ef4444' : isPatch ? '#ffffff' : color }}
      >
        {layer.label || `Layer ${layer.layerId}`}
        {isProcessing && ' ⏳'}
        {isFailed && ' ❌'}
      </span>
      {isDragging && (
        <span className="ml-auto text-[10px] text-white/70 font-mono">
          {snapToFrame(dragLeft / pixelsPerSecond).toFixed(2)}s
        </span>
      )}
    </div>
  );
}

// 트랙 레이블
function TrackLabel({ 
  track,
  onUploadVideo,
  onUploadJson,
  onUploadPatch,
  hasLayers,
}: { 
  track: Track;
  onUploadVideo: (trackId: number, file: File) => void;
  onUploadJson: (trackId: number, file: File) => void;
  onUploadPatch: (trackId: number, file: File) => void;
  hasLayers: boolean;
}) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const patchInputRef = useRef<HTMLInputElement>(null);
  const color = TRACK_COLORS[track.slot];

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadVideo(track.trackId, file);
      e.target.value = '';
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJson(track.trackId, file);
      e.target.value = '';
    }
  };

  const handlePatchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPatch(track.trackId, file);
      e.target.value = '';
    }
  };

  return (
    <div className="h-14 px-3 flex items-center gap-2 border-b border-r border-surface-700 bg-surface-800">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-surface-300 truncate flex-1">
        {track.displayName || `Dancer ${track.slot}`}
      </span>
      
      {/* 영상 업로드 버튼 */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
      />
      <button
        onClick={() => videoInputRef.current?.click()}
        title="영상 업로드"
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded transition-all',
          'bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-white',
          'border border-surface-600 hover:border-surface-500'
        )}
      >
        <Video className="w-3.5 h-3.5" />
      </button>

      {/* JSON 업로드 버튼 */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        onChange={handleJsonChange}
        className="hidden"
      />
      <button
        onClick={() => jsonInputRef.current?.click()}
        title="스켈레톤 JSON 업로드"
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded transition-all',
          'bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-white',
          'border border-surface-600 hover:border-surface-500'
        )}
      >
        <FileJson className="w-3.5 h-3.5" />
      </button>

      {/* 패치 업로드 버튼 (기존 레이어가 있을 때만 활성화) */}
      <input
        ref={patchInputRef}
        type="file"
        accept=".json"
        onChange={handlePatchChange}
        className="hidden"
      />
      <button
        onClick={() => patchInputRef.current?.click()}
        title={hasLayers ? "세그먼트 패치 업로드" : "먼저 기본 JSON을 업로드하세요"}
        disabled={!hasLayers}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded transition-all',
          hasLayers 
            ? 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 hover:text-amber-300 border border-amber-600/50 hover:border-amber-500'
            : 'bg-surface-800 text-surface-600 border border-surface-700 cursor-not-allowed'
        )}
      >
        <Layers className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// 패치 레이어 판별 (priority > 100은 패치로 간주)
const PATCH_PRIORITY_THRESHOLD = 100;

// 트랙 내용
function TrackContent({ 
  track,
  duration,
  pixelsPerSecond,
  onLayerDragMove,
  onLayerContextMenu,
}: { 
  track: Track;
  duration: number;
  pixelsPerSecond: number;
  onLayerDragMove: (layerId: number, newStartSec: number) => void;
  onLayerContextMenu: (e: React.MouseEvent, layer: Layer) => void;
}) {
  const color = TRACK_COLORS[track.slot];
  const totalWidth = duration * pixelsPerSecond;

  // priority 순으로 정렬 (낮은 것 먼저 렌더링, 높은 것이 위에 표시)
  const sortedLayers = [...track.layers].sort((a, b) => a.priority - b.priority);

  return (
    <div 
      className="h-14 bg-surface-900/50 relative timeline-grid border-b border-surface-700"
      style={{ width: totalWidth }}
    >
      {sortedLayers.map((layer) => (
        <LayerBlock 
          key={layer.layerId} 
          layer={layer} 
          color={color} 
          pixelsPerSecond={pixelsPerSecond}
          onDragMove={onLayerDragMove}
          isPatch={layer.priority >= PATCH_PRIORITY_THRESHOLD}
          onContextMenu={onLayerContextMenu}
        />
      ))}
    </div>
  );
}

// 음악 트랙 레이블
function MusicTrackLabel() {
  return (
    <div className="h-10 px-3 flex items-center gap-2 border-b border-r border-surface-700 bg-surface-800">
      <span className="text-sm text-accent-400">🎵 Music</span>
    </div>
  );
}

// 음악 트랙 내용
function MusicTrackContent({ duration, musicDuration, pixelsPerSecond }: { duration: number; musicDuration: number; pixelsPerSecond: number }) {
  const totalWidth = duration * pixelsPerSecond;
  const musicWidth = musicDuration * pixelsPerSecond;
  
  return (
    <div 
      className="h-10 bg-surface-900/50 relative timeline-grid border-b border-surface-700"
      style={{ width: totalWidth }}
    >
      <div 
        className="absolute top-1 bottom-1 left-0 rounded bg-accent-600/20 border border-accent-600/30"
        style={{ width: musicWidth }}
      />
    </div>
  );
}

// 눈금자 레이블 (빈 영역)
function RulerLabel() {
  return (
    <div className="h-8 border-b border-r border-surface-700 bg-surface-800" />
  );
}

// ============================================
// Main Component
// ============================================

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const project = useCurrentProject();
  const currentTime = useCurrentTime();
  const isPlaying = useIsPlaying();
  const setCurrentProject = useProjectStore(state => state.setCurrentProject);
  const setCurrentTime = useProjectStore(state => state.setCurrentTime);
  const togglePlayback = useProjectStore(state => state.togglePlayback);
  const addLayer = useProjectStore(state => state.addLayer);
  const updateLayer = useProjectStore(state => state.updateLayer);
  const removeLayer = useProjectStore(state => state.removeLayer);
  const addPositionKeyframe = useProjectStore(state => state.addPositionKeyframe);

  // 타임라인 줌 상태
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  
  // Top View 모드 (재생/편집)
  const [topViewMode, setTopViewMode] = useState<'play' | 'edit'>('play');
  
  // 스켈레톤 데이터 캐시 (layerId → SkeletonJson)
  // localStorage에서 초기화 (새로고침해도 유지)
  const [skeletonCache, setSkeletonCache] = useState<Map<number, SkeletonJson>>(() => {
    if (!projectId) return new Map();
    try {
      const cached = localStorage.getItem(`skeleton-cache-${projectId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as [number, SkeletonJson][];
        console.log(`📦 Restored ${parsed.length} skeletons from localStorage`);
        return new Map(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore skeleton cache:', e);
    }
    return new Map();
  });
  
  // 저장 상태 ('idle' | 'saving' | 'saved' | 'error')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    layer: Layer;
    trackId: number;
  } | null>(null);
  
  // 줌 핸들러 (드래그 delta 기반)
  const handleZoom = useCallback((delta: number) => {
    setPixelsPerSecond(prev => {
      const newValue = prev + delta;
      return Math.min(MAX_PIXELS_PER_SECOND, Math.max(MIN_PIXELS_PER_SECOND, newValue));
    });
  }, []);
  
  // 스켈레톤 캐시에 추가 (localStorage에도 저장)
  const addToSkeletonCache = useCallback((layerId: number, data: SkeletonJson) => {
    setSkeletonCache(prev => {
      const newCache = new Map(prev).set(layerId, data);
      // localStorage에 저장
      try {
        localStorage.setItem(
          `skeleton-cache-${projectId}`,
          JSON.stringify(Array.from(newCache.entries()))
        );
        console.log(`💾 Saved ${newCache.size} skeletons to localStorage`);
      } catch (e) {
        console.warn('Failed to save skeleton cache:', e);
      }
      return newCache;
    });
  }, [projectId]);

  // 프로젝트 로드 상태
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 프로젝트 로드
  useEffect(() => {
    if (!projectId) return;
    
    const numericId = parseInt(projectId, 10);
    
    // 이미 같은 프로젝트가 로드되어 있으면 스킵
    if (project && project.id === numericId) return;
    
    const loadProject = async () => {
      setIsLoadingProject(true);
      setLoadError(null);
      
      try {
        console.log('📦 Loading project edit-state:', numericId);
        const editState = await projectApi.getEditState(numericId);
        console.log('✅ Edit state loaded:', editState);
        
        // API 응답을 프론트엔드 Project 타입으로 변환
        const transformedProject: Project = {
          id: editState.project.id,
          title: editState.project.title,
          music: {
            objectKey: editState.project.music_object_key,
            durationSec: editState.project.music_duration_sec 
              ? Number(editState.project.music_duration_sec) 
              : 0,
            bpm: editState.project.music_bpm 
              ? Number(editState.project.music_bpm) 
              : null,
          },
          tracks: editState.tracks.map(track => ({
            trackId: track.id,
            slot: track.slot as TrackSlot,
            displayName: track.display_name,
            layers: track.layers.map(layer => ({
              layerId: layer.id,
              trackId: track.id,
              startSec: Number(layer.start_sec),
              endSec: Number(layer.end_sec),
              priority: layer.priority,
              label: layer.label,
              fadeInSec: 0,
              fadeOutSec: 0,
              skeleton: {
                sourceId: layer.skeleton_source_id,
                status: layer.source_status as AssetStatus,
                objectKey: layer.source_object_key,
                fps: layer.source_fps ?? 24,
                numFrames: layer.source_num_frames ?? 0,
                numJoints: layer.source_num_joints ?? 33,
                poseModel: null,
              },
            })),
            positionKeyframes: track.keyframes.map(kf => ({
              id: kf.id,
              timeSec: Number(kf.time_sec),
              x: Number(kf.x),
              y: Number(kf.y),
              interp: kf.interp as InterpType,
            })),
          })),
          createdAt: editState.project.created_at,
          updatedAt: editState.project.updated_at,
        };
        
        // 각 트랙에 기본 position keyframe이 없으면 추가
        transformedProject.tracks.forEach(track => {
          if (track.positionKeyframes.length === 0) {
            // 기본 위치 설정 (slot 1: 왼쪽, slot 2: 중앙, slot 3: 오른쪽)
            const defaultX = track.slot === 1 ? 0.25 : track.slot === 2 ? 0.5 : 0.75;
            track.positionKeyframes.push({
              id: Date.now() + track.slot,
              timeSec: 0,
              x: defaultX,
              y: 0.5,
              interp: 'STEP',
            });
          }
        });
        
        // localStorage에서 스켈레톤 캐시 확인하고 레이어 상태 업데이트
        const cachedSkeletons = localStorage.getItem(`skeleton-cache-${numericId}`);
        if (cachedSkeletons) {
          const parsed = JSON.parse(cachedSkeletons) as [number, SkeletonJson][];
          const cachedLayerIds = new Set(parsed.map(([id]) => id));
          console.log(`📦 Found ${parsed.length} cached skeletons in localStorage`);
          
          // 캐시에 있는 레이어는 상태를 READY로 변경
          transformedProject.tracks.forEach(track => {
            track.layers.forEach(layer => {
              if (cachedLayerIds.has(layer.layerId)) {
                layer.skeleton.status = 'READY';
              }
            });
          });
        } else {
          // 캐시가 없으면 스켈레톤 상태를 PROCESSING으로 표시 (모래시계)
          const layersWithoutCache = transformedProject.tracks.flatMap(t => t.layers);
          if (layersWithoutCache.length > 0) {
            console.log(`⚠️ No cached skeletons found. ${layersWithoutCache.length} layers need JSON upload.`);
          }
        }
        
        setCurrentProject(transformedProject);
        console.log('✅ Project loaded and transformed');
        
      } catch (err) {
        console.error('❌ Failed to load project:', err);
        setLoadError(err instanceof Error ? err.message : '프로젝트를 불러오는데 실패했습니다.');
      } finally {
        setIsLoadingProject(false);
      }
    };
    
    loadProject();
  }, [projectId, project, setCurrentProject]);

  // 타임라인 전체 길이 계산
  const timelineDuration = useMemo(() => {
    if (!project) return 0;
    
    const trackEndTimes = project.tracks.map(track => 
      track.layers.reduce((max, layer) => Math.max(max, layer.endSec), 0)
    );
    
    return Math.max(project.music.durationSec, ...trackEndTimes);
  }, [project]);

  // 오디오 ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // 음악 presigned URL 발급
  useEffect(() => {
    if (!project?.music.objectKey) {
      setAudioUrl(null);
      return;
    }
    
    const fetchAudioUrl = async () => {
      try {
        console.log('🎵 Fetching presigned URL for:', project.music.objectKey);
        const response = await assetsApi.getPresignedUrl(project.music.objectKey!);
        
        // Docker 내부 주소를 Vite 프록시 경로로 변환 (개발 환경용)
        // http://minio:9000/collabography/... → /minio-presign/collabography/...
        const fixedUrl = response.url.replace('http://minio:9000', '/minio-presign');
        console.log('✅ Audio URL received:', fixedUrl);
        setAudioUrl(fixedUrl);
      } catch (err) {
        console.error('❌ Failed to get audio presigned URL:', err);
      }
    };
    
    fetchAudioUrl();
  }, [project?.music.objectKey]);
  
  // 오디오 element 생성
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio();
      
      // 로드 완료 이벤트
      audio.addEventListener('canplaythrough', () => {
        console.log('✅ Audio ready to play');
      });
      
      // 에러 이벤트
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio load error:', audio.error?.message);
      });
      
      audio.src = audioUrl;
      audio.load();
      audioRef.current = audio;
      
      return () => {
        audio.pause();
        audio.src = '';
        audioRef.current = null;
      };
    }
  }, [audioUrl]);

  // 재생 애니메이션
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  
  useEffect(() => {
    if (!isPlaying || !project) return;
    
    // 오디오 재생
    if (audioRef.current) {
      audioRef.current.currentTime = currentTimeRef.current;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
    
    let lastTime = performance.now();
    let animationId: number;
    
    const animate = (now: number) => {
      const delta = (now - lastTime) / 1000; // 초 단위
      lastTime = now;
      
      const newTime = currentTimeRef.current + delta;
      
      // 끝에 도달하면 정지
      if (newTime >= timelineDuration) {
        currentTimeRef.current = timelineDuration;
        setCurrentTime(timelineDuration);
        togglePlayback();
        return;
      }
      
      // ref와 state 둘 다 업데이트
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
      // 오디오 일시정지
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isPlaying, project, timelineDuration, setCurrentTime, togglePlayback]);

  // 시간 이동 (seek) 핸들러
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    currentTimeRef.current = time;
    
    // 음악 재생 위치도 동기화
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [setCurrentTime]);

  // ============================================
  // 레이어 컨텍스트 메뉴 핸들러
  // ============================================

  // 컨텍스트 메뉴 열기
  const handleLayerContextMenu = useCallback((e: React.MouseEvent, layer: Layer) => {
    // trackId 찾기
    const track = project?.tracks.find(t => t.layers.some(l => l.layerId === layer.layerId));
    if (!track) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      layer,
      trackId: track.trackId,
    });
  }, [project]);

  // 컨텍스트 메뉴 닫기
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 맨 앞으로 가져오기 (트랙 내 최대 priority + 1)
  const handleBringToFront = useCallback(() => {
    if (!contextMenu || !project) return;
    
    const track = project.tracks.find(t => t.trackId === contextMenu.trackId);
    if (!track) return;
    
    const maxPriority = Math.max(...track.layers.map(l => l.priority));
    if (contextMenu.layer.priority < maxPriority) {
      updateLayer(contextMenu.layer.layerId, { priority: maxPriority + 1 });
      console.log(`🔼 [맨 앞으로] ${contextMenu.layer.label}: ${contextMenu.layer.priority} → ${maxPriority + 1}`);
    }
  }, [contextMenu, project, updateLayer]);

  // 앞으로 가져오기 (priority + 1, 단 같은 값이 있으면 swap)
  const handleBringForward = useCallback(() => {
    if (!contextMenu || !project) return;
    
    const track = project.tracks.find(t => t.trackId === contextMenu.trackId);
    if (!track) return;
    
    // 현재 priority보다 높은 레이어 중 가장 낮은 것 찾기
    const higherLayers = track.layers
      .filter(l => l.priority > contextMenu.layer.priority)
      .sort((a, b) => a.priority - b.priority);
    
    if (higherLayers.length > 0) {
      const nextLayer = higherLayers[0];
      // Swap priorities
      updateLayer(contextMenu.layer.layerId, { priority: nextLayer.priority });
      updateLayer(nextLayer.layerId, { priority: contextMenu.layer.priority });
      console.log(`🔼 [앞으로] ${contextMenu.layer.label}: ${contextMenu.layer.priority} ↔ ${nextLayer.priority}`);
    }
  }, [contextMenu, project, updateLayer]);

  // 맨 뒤로 보내기 (트랙 내 최소 priority - 1, 최소 1)
  const handleSendToBack = useCallback(() => {
    if (!contextMenu || !project) return;
    
    const track = project.tracks.find(t => t.trackId === contextMenu.trackId);
    if (!track) return;
    
    const minPriority = Math.min(...track.layers.map(l => l.priority));
    if (contextMenu.layer.priority > minPriority) {
      const newPriority = Math.max(1, minPriority - 1);
      updateLayer(contextMenu.layer.layerId, { priority: newPriority });
      console.log(`🔽 [맨 뒤로] ${contextMenu.layer.label}: ${contextMenu.layer.priority} → ${newPriority}`);
    }
  }, [contextMenu, project, updateLayer]);

  // 뒤로 보내기 (priority - 1, 단 같은 값이 있으면 swap)
  const handleSendBackward = useCallback(() => {
    if (!contextMenu || !project) return;
    
    const track = project.tracks.find(t => t.trackId === contextMenu.trackId);
    if (!track) return;
    
    // 현재 priority보다 낮은 레이어 중 가장 높은 것 찾기
    const lowerLayers = track.layers
      .filter(l => l.priority < contextMenu.layer.priority)
      .sort((a, b) => b.priority - a.priority);
    
    if (lowerLayers.length > 0) {
      const prevLayer = lowerLayers[0];
      // Swap priorities
      updateLayer(contextMenu.layer.layerId, { priority: prevLayer.priority });
      updateLayer(prevLayer.layerId, { priority: contextMenu.layer.priority });
      console.log(`🔽 [뒤로] ${contextMenu.layer.label}: ${contextMenu.layer.priority} ↔ ${prevLayer.priority}`);
    }
  }, [contextMenu, project, updateLayer]);

  // 레이어 삭제
  const handleDeleteLayer = useCallback(() => {
    if (!contextMenu) return;
    
    // 스켈레톤 캐시에서도 제거
    setSkeletonCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(contextMenu.layer.layerId);
      return newCache;
    });
    
    removeLayer(contextMenu.layer.layerId);
    console.log(`🗑️ [삭제] ${contextMenu.layer.label}`);
  }, [contextMenu, removeLayer]);

  // 동영상 업로드 핸들러
  const handleUploadVideo = useCallback((trackId: number, file: File) => {
    console.log(`Uploading video for Track ${trackId}:`, file.name);
    
    const videoUrl = URL.createObjectURL(file);
    
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      console.log(`Video duration: ${duration}s`);
      
      const track = project?.tracks.find(t => t.trackId === trackId);
      const lastEndTime = track?.layers.reduce((max, layer) => 
        Math.max(max, layer.endSec), 0
      ) ?? 0;
      
      // 새 레이어의 priority 계산 (가장 높은 값 + 1)
      const maxPriority = track?.layers.reduce((max, layer) => 
        Math.max(max, layer.priority), 0
      ) ?? 0;
      
      // TODO: 백엔드 연동 시 API 호출로 대체
      // 1. layerApi.initUpload() - presigned URL 발급
      // 2. uploadToMinIO() - MinIO에 업로드
      // 3. layerApi.create() - 레이어 생성
      
      // 임시: 로컬에서 레이어 추가
      addLayer(trackId, {
        layerId: Date.now(),
        trackId,
        startSec: lastEndTime,
        endSec: lastEndTime + duration,
        priority: maxPriority + 1,
        label: file.name.replace(/\.[^/.]+$/, ''),
        fadeInSec: 0,
        fadeOutSec: 0,
        skeleton: {
          sourceId: Date.now(),
          status: 'PROCESSING',
          objectKey: null,
          fps: 24,
          numFrames: Math.floor(duration * 24),
          numJoints: 33,
          poseModel: 'mediapipe_pose',
        },
      });
      
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      console.error('Failed to load video metadata');
      URL.revokeObjectURL(videoUrl);
    };
    
    video.src = videoUrl;
  }, [project, addLayer]);

  // JSON 업로드 핸들러
  const handleUploadJson = useCallback(async (trackId: number, file: File) => {
    console.log(`Uploading skeleton JSON for Track ${trackId}:`, file.name);
    
    try {
      // 1. 먼저 JSON 파일을 파싱하여 메타데이터 추출
      const rawText = await file.text();
      const json = JSON.parse(rawText);
      
      if (!json.meta && !json.frames) {
        throw new Error('Invalid skeleton JSON: missing meta or frames');
      }
      
      const meta = json.meta || {};
      const frames = json.frames || [];
      const fps = meta.fps || 24;
      const numFrames = frames.length || meta.num_frames_sampled || 0;
      const duration = numFrames / fps;
      
      if (numFrames === 0) {
        throw new Error('No frames found in skeleton JSON');
      }
      
      console.log(`📊 Parsed: ${numFrames} frames, ${duration.toFixed(1)}s, ${fps}fps`);
      
      // 2. 트랙 정보 가져오기
      const track = project?.tracks.find(t => t.trackId === trackId);
      const lastEndTime = track?.layers.reduce((max, layer) => 
        Math.max(max, layer.endSec), 0
      ) ?? 0;
      const maxPriority = track?.layers.reduce((max, layer) => 
        Math.max(max, layer.priority), 0
      ) ?? 0;
      
      // 3. 백엔드에 레이어 업로드
      console.log('⬆️ Uploading to backend...');
      const response = await layerApi.upload(
        trackId,
        file,
        lastEndTime,
        lastEndTime + duration,
        maxPriority + 1,
        file.name.replace(/\.[^/.]+$/, '')
      );
      console.log('✅ Layer created:', response);
      
      // 4. 시간 정보 계산 (백엔드가 upload 시 시간을 무시할 수 있음)
      const startSec = lastEndTime;
      const endSec = lastEndTime + duration;
      
      // 백엔드에 시간 업데이트
      if (Number(response.start_sec) !== startSec || Number(response.end_sec) !== endSec) {
        console.log('⏱️ Updating layer time...', { startSec, endSec });
        await layerApi.update(trackId, response.id, {
          start_sec: startSec,
          end_sec: endSec,
        });
      }
      
      // 5. 스토어에 레이어 추가 (계산된 시간 사용, 즉시 READY 상태)
      addLayer(trackId, {
        layerId: response.id,
        trackId: response.track_id,
        startSec: startSec,
        endSec: endSec,
        priority: response.priority,
        label: response.label,
        fadeInSec: 0,
        fadeOutSec: 0,
        skeleton: {
          sourceId: response.skeleton_source_id,
          status: 'READY',  // JSON 직접 업로드는 즉시 READY
          objectKey: response.source_object_key,
          fps: fps,
          numFrames: numFrames,
          numJoints: meta.num_joints || 33,
          poseModel: meta.pose_model || null,
        },
      });
      
      // 6. 스켈레톤 데이터를 캐시에 저장 (즉시 렌더링용)
      addToSkeletonCache(response.id, json as SkeletonJson);
      
      console.log(`✅ Layer uploaded: ID=${response.id}, ${numFrames} frames, status=READY`);
      
    } catch (err) {
      console.error('❌ Failed to upload skeleton JSON:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`스켈레톤 JSON 업로드 실패:\n\n${errorMessage}`);
    }
  }, [project, addLayer, addToSkeletonCache]);

  // 패치 JSON 업로드 핸들러 (높은 priority로 추가, 현재 시간 위치에 배치)
  const handleUploadPatch = useCallback(async (trackId: number, file: File) => {
    console.log(`📌 Uploading PATCH for Track ${trackId}:`, file.name);
    
    try {
      // 1. JSON 파일 파싱
      const rawText = await file.text();
      const json = JSON.parse(rawText);
      
      if (!json.meta && !json.frames) {
        throw new Error('Invalid skeleton JSON: missing meta or frames');
      }
      
      const meta = json.meta || {};
      const frames = json.frames || [];
      const fps = meta.fps || 24;
      const numFrames = frames.length || meta.num_frames_sampled || 0;
      const duration = numFrames / fps;
      
      if (numFrames === 0) {
        throw new Error('No frames found in skeleton JSON');
      }
      
      // 패치는 현재 재생 시간 위치에 배치 (프레임 스냅 적용)
      const snappedStartTime = snapToFrame(currentTime);
      
      // store에서 최신 상태를 직접 가져와서 최대 priority 계산
      const currentState = useProjectStore.getState();
      const latestProject = currentState.currentProject;
      const track = latestProject?.tracks.find(t => t.trackId === trackId);
      const maxPriority = track?.layers.reduce((max, layer) => 
        Math.max(max, layer.priority), PATCH_PRIORITY_THRESHOLD
      ) ?? PATCH_PRIORITY_THRESHOLD;
      
      console.log(`📊 Current max priority: ${maxPriority}, new patch: ${maxPriority + 1}`);
      
      // 2. 백엔드에 레이어 업로드
      console.log('⬆️ Uploading patch to backend...');
      const response = await layerApi.upload(
        trackId,
        file,
        snappedStartTime,
        snappedStartTime + duration,
        maxPriority + 1,
        file.name.replace(/\.[^/.]+$/, '')
      );
      console.log('✅ Patch layer created:', response);
      
      // 3. 시간 정보 계산 (백엔드가 upload 시 시간을 무시할 수 있음)
      const startSec = snappedStartTime;
      const endSec = snappedStartTime + duration;
      
      // 백엔드에 시간 업데이트
      if (Number(response.start_sec) !== startSec || Number(response.end_sec) !== endSec) {
        console.log('⏱️ Updating patch time...', { startSec, endSec });
        await layerApi.update(trackId, response.id, {
          start_sec: startSec,
          end_sec: endSec,
        });
      }
      
      // 4. 스토어에 레이어 추가 (계산된 시간 사용, 즉시 READY 상태)
      addLayer(trackId, {
        layerId: response.id,
        trackId: response.track_id,
        startSec: startSec,
        endSec: endSec,
        priority: response.priority,
        label: response.label,
        fadeInSec: 0,
        fadeOutSec: 0,
        skeleton: {
          sourceId: response.skeleton_source_id,
          status: 'READY',  // JSON 직접 업로드는 즉시 READY
          objectKey: response.source_object_key,
          fps: fps,
          numFrames: numFrames,
          numJoints: meta.num_joints || 33,
          poseModel: meta.pose_model || null,
        },
      });
      
      // 5. 캐시에 스켈레톤 데이터 저장
      addToSkeletonCache(response.id, json as SkeletonJson);
      
      console.log(`✅ PATCH uploaded at ${snappedStartTime.toFixed(2)}s: ${numFrames} frames, status=READY`);
      
    } catch (err) {
      console.error('❌ Failed to upload patch:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`패치 업로드 실패:\n\n${errorMessage}`);
    }
  }, [currentTime, addLayer, addToSkeletonCache]);

  // 레이어 드래그 이동 핸들러
  const handleLayerDragMove = useCallback((layerId: number, newStartSec: number) => {
    // 해당 레이어 찾기
    if (!project) return;
    
    let targetLayer: Layer | null = null;
    for (const track of project.tracks) {
      const layer = track.layers.find(l => l.layerId === layerId);
      if (layer) {
        targetLayer = layer;
        break;
      }
    }
    
    if (!targetLayer) return;
    
    const duration = targetLayer.endSec - targetLayer.startSec;
    const newEndSec = newStartSec + duration;
    
    updateLayer(layerId, {
      startSec: newStartSec,
      endSec: newEndSec,
    });
    
    console.log(`🔄 Layer ${layerId} moved to ${newStartSec.toFixed(2)}s - ${newEndSec.toFixed(2)}s`);
  }, [project, updateLayer]);

  // 각 트랙에서 현재 시간에 활성화된 레이어의 스켈레톤 데이터 + Top View 위치
  const frontViewDancers = useMemo(() => {
    if (!project) return [];
    
    return project.tracks.map(track => {
      // 현재 시간에 활성화된 레이어 찾기
      const activeLayers = track.layers.filter(
        layer => layer.startSec <= currentTime && currentTime < layer.endSec
      );
      
      // READY 상태이고 캐시에 데이터가 있는 레이어만 필터링
      const readyLayers = activeLayers.filter(
        layer => layer.skeleton.status === 'READY' && skeletonCache.has(layer.layerId)
      );
      
      // 그 중에서 priority가 가장 높은 레이어 선택
      const activeLayer = readyLayers.length > 0
        ? readyLayers.reduce((max, layer) => layer.priority > max.priority ? layer : max)
        : null;
      
      // 스켈레톤 데이터 가져오기
      const skeletonData = activeLayer
        ? skeletonCache.get(activeLayer.layerId) || null
        : null;
      
      // 레이어 시작 시간 기준으로 로컬 시간 계산
      const localTime = activeLayer ? currentTime - activeLayer.startSec : 0;
      
      // Top View 위치 계산 (interpolatePosition 사용)
      const topViewPosition = interpolatePosition(track.positionKeyframes, currentTime);
      
      // 디버깅용 로그
      if (readyLayers.length > 1) {
        console.log(`[Track ${track.slot}] Active layers:`, 
          readyLayers.map(l => `${l.label}(P${l.priority})`).join(', '),
          `→ Selected: ${activeLayer?.label}(P${activeLayer?.priority})`
        );
      }
      
      return {
        slot: track.slot,
        skeletonData,
        localTime,
        topViewPosition, // Top View 위치 추가
      };
    });
  }, [project, currentTime, skeletonCache]);

  // Top View 위치 저장 핸들러
  const handleSavePositions = useCallback((positions: Array<{ slot: TrackSlot; x: number; y: number }>) => {
    if (!project) return;
    
    positions.forEach(({ slot, x, y }) => {
      const track = project.tracks.find(t => t.slot === slot);
      if (track) {
        // 새 STEP 키프레임 추가
        addPositionKeyframe(track.trackId, {
          id: Date.now() + slot, // 유니크 ID
          timeSec: currentTime,
          x,
          y,
          interp: 'STEP',
        });
        console.log(`✅ Saved position for Dancer ${slot} at ${currentTime.toFixed(2)}s: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    });
  }, [project, currentTime, addPositionKeyframe]);

  // 편집 모드 변경 시 재생 중이면 일시정지
  const handleTopViewModeChange = useCallback((newMode: 'play' | 'edit') => {
    if (newMode === 'edit' && isPlaying) {
      togglePlayback();
    }
    setTopViewMode(newMode);
  }, [isPlaying, togglePlayback]);

  // ============================================
  // 저장 기능
  // ============================================
  
  /**
   * 프로젝트 상태를 백엔드에 저장
   * 1. 각 레이어의 정보 (start_sec, end_sec, priority, label) → PATCH /layers/{layer_id}
   * 2. 각 트랙의 Position Keyframes → PUT /tracks/{track_id}/position-keyframes
   */
  const handleSaveProject = useCallback(async () => {
    if (!project) return;
    
    setSaveStatus('saving');
    setSaveError(null);
    
    // ============================================
    // [DEBUG] 백엔드 연동 전 - Console에 저장할 데이터 출력
    // ============================================
    
    console.log('📦 ===== SAVE PROJECT DATA =====');
    console.log('Project ID:', project.id);
    console.log('Project Title:', project.title);
    console.log('');
    
    // 1. 각 레이어 데이터 출력
    console.log('🎬 LAYERS (PATCH /layers/{layer_id}):');
    project.tracks.forEach(track => {
      console.log(`\n  Track ${track.slot} (trackId: ${track.trackId}):`);
      track.layers.forEach(layer => {
        const layerBody = {
          start_sec: layer.startSec,
          end_sec: layer.endSec,
          priority: layer.priority,
          label: layer.label ?? null,
          fade_in_sec: layer.fadeInSec,
          fade_out_sec: layer.fadeOutSec,
        };
        console.log(`    [Layer ${layer.layerId}] ${layer.label || 'unnamed'}:`, layerBody);
      });
    });
    
    console.log('');
    
    // 2. 각 트랙의 Position Keyframes 출력
    console.log('📍 POSITION KEYFRAMES (PUT /tracks/{track_id}/position-keyframes):');
    project.tracks.forEach(track => {
      const keyframesBody = {
        keyframes: track.positionKeyframes.map(kf => ({
          time_sec: kf.timeSec,
          x: kf.x,
          y: kf.y,
          interp: kf.interp,
        }))
      };
      console.log(`\n  Track ${track.slot} (trackId: ${track.trackId}):`, keyframesBody);
    });
    
    console.log('');
    console.log('📦 ===== END SAVE DATA =====');
    
    try {
      // 1. 백엔드에 저장된 레이어만 업데이트 (임시 생성된 레이어는 스킵)
      // 임시 레이어 ID는 Date.now()로 생성되어 매우 큰 숫자 (10억 이상)
      const MAX_BACKEND_ID = 1000000000;
      
      const layerPromises = project.tracks.flatMap(track =>
        track.layers
          .filter(layer => layer.layerId < MAX_BACKEND_ID) // 백엔드 레이어만
          .map(layer =>
            layerApi.update(track.trackId, layer.layerId, {
              start_sec: layer.startSec,
              end_sec: layer.endSec,
              priority: layer.priority,
              label: layer.label ?? undefined,
            }).catch(err => {
              console.warn(`⚠️ Failed to update layer ${layer.layerId}:`, err.message);
              return null; // 개별 실패는 무시
            })
          )
      );
      
      // 2. 모든 트랙의 Position Keyframes 저장
      const keyframePromises = project.tracks.map(track =>
        keyframeApi.update(
          track.trackId,
          track.positionKeyframes
            .filter(kf => kf.x !== undefined && kf.y !== undefined)
            .map(kf => ({
              time_sec: kf.timeSec,
              x: kf.x!,
              y: kf.y!,
              interp: kf.interp,
            }))
        ).catch(err => {
          console.warn(`⚠️ Failed to update keyframes for track ${track.trackId}:`, err.message);
          return null; // 개별 실패는 무시
        })
      );
      
      // 병렬로 모든 요청 실행 (개별 실패는 무시됨)
      await Promise.all([...layerPromises, ...keyframePromises]);
      
      setSaveStatus('saved');
      console.log('✅ Project saved successfully!');
      
      // 2초 후 idle 상태로 복귀
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to save project:', error);
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.');
      
      // 3초 후 idle 상태로 복귀
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveError(null);
      }, 3000);
    }
  }, [project]);

  // 로딩 중
  if (isLoadingProject || !project) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent-500 animate-spin mx-auto mb-4" />
          <p className="text-surface-400">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 발생
  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <ArrowLeft className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-surface-200 mb-2">로딩 실패</h2>
          <p className="text-surface-400 mb-6 max-w-md">{loadError}</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            프로젝트 목록으로
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-900 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <header className="flex-shrink-0 h-14 border-b border-surface-700 bg-surface-800/50 backdrop-blur-sm flex items-center px-4 gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        
        <div className="h-6 w-px bg-surface-700" />
        
        <h1 className="font-medium text-white truncate">
          {project.title}
        </h1>
        
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-surface-500 font-mono">
            {project.music.objectKey?.split('/').pop() || 'No music'}
          </span>
          
          {/* 저장 버튼 */}
          <Button
            variant={saveStatus === 'error' ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleSaveProject}
            disabled={saveStatus === 'saving'}
            className={cn(
              'flex items-center gap-2 px-3 h-8 transition-all',
              saveStatus === 'saved' && 'text-green-400 border-green-500/50',
              saveStatus === 'error' && 'text-red-400 border-red-500/50 bg-red-500/10',
            )}
            title={saveError || '프로젝트 저장'}
          >
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>저장 중...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-4 h-4" />
                <span>저장됨</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <Save className="w-4 h-4" />
                <span>재시도</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <Save className="w-4 h-4" />
                <span>저장</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 프리뷰 영역 */}
        <div className="flex-1 min-h-0 p-4 flex gap-4">
          <div className="flex-1 min-w-0">
            {/* Top View - 무대 배치도 (재생/편집 모드) */}
            <div className="h-full bg-surface-900 rounded-lg border border-surface-700 overflow-hidden relative">
              <TopViewEditor
                dancers={project.tracks.map(t => ({
                  slot: t.slot,
                  positionKeyframes: t.positionKeyframes,
                }))}
                currentTime={currentTime}
                mode={topViewMode}
                onModeChange={handleTopViewModeChange}
                onSavePositions={handleSavePositions}
                showPaths={true}
                showKeyframes={true}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 h-full">
            {/* Front View - 스켈레톤 렌더링 */}
            <div className="h-full bg-surface-900 rounded-lg border border-surface-700 overflow-hidden">
              {frontViewDancers.some(d => d.skeletonData) ? (
                <FrontView 
                  dancers={frontViewDancers.map(d => ({
                    slot: d.slot,
                    skeletonData: d.skeletonData,
                    localTime: d.localTime,
                    topViewPosition: d.topViewPosition, // Top View 위치 전달
                  }))}
                />
              ) : (
                <FrontViewPlaceholder />
              )}
            </div>
          </div>
        </div>

        {/* 타임라인 영역 */}
        <div className="flex-shrink-0 border-t border-surface-700 bg-surface-800/30">
          {/* 재생 컨트롤 */}
          <div className="h-12 border-b border-surface-700 flex items-center px-4 gap-4">
            <div className="flex items-center gap-2">
              {/* 처음으로 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentTime(0)}
                className="w-8 h-8 p-0"
                title="처음으로"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              {/* 재생/일시정지 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayback}
                className={cn(
                  'w-10 h-10 p-0 rounded-full',
                  isPlaying && 'bg-accent-600 hover:bg-accent-500'
                )}
                title={isPlaying ? '일시정지' : '재생'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>
              
              {/* 정지 (처음부터) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isPlaying) togglePlayback();
                  setCurrentTime(0);
                }}
                className="w-8 h-8 p-0"
                title="정지"
              >
                <Square className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="font-mono text-sm text-surface-300">
              <span className="text-white">{formatTimeWithMs(currentTime)}</span>
              <span className="text-surface-500 mx-1">/</span>
              <span>{formatTimeWithMs(project.music.durationSec)}</span>
            </div>
          </div>

          {/* 타임라인 */}
          <div className="flex max-h-72">
            {/* 왼쪽: 트랙 레이블 (고정) */}
            <div className="w-44 flex-shrink-0 overflow-y-auto">
              <RulerLabel />
              <MusicTrackLabel />
              {project.tracks.map((track) => (
                <TrackLabel
                  key={track.trackId}
                  track={track}
                  onUploadVideo={handleUploadVideo}
                  onUploadJson={handleUploadJson}
                  onUploadPatch={handleUploadPatch}
                  hasLayers={track.layers.length > 0}
                />
              ))}
            </div>
            
            {/* 오른쪽: 타임라인 내용 (스크롤 가능) */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="relative" style={{ minWidth: timelineDuration * pixelsPerSecond }}>
                <TimelineRulerContent 
                  duration={timelineDuration} 
                  pixelsPerSecond={pixelsPerSecond}
                  currentTime={currentTime}
                  onZoom={handleZoom}
                  onSeek={handleSeek}
                />
                <MusicTrackContent 
                  duration={timelineDuration} 
                  musicDuration={project.music.durationSec} 
                  pixelsPerSecond={pixelsPerSecond}
                />
                {project.tracks.map((track) => (
                  <TrackContent
                    key={track.trackId}
                    track={track}
                    duration={timelineDuration}
                    pixelsPerSecond={pixelsPerSecond}
                    onLayerDragMove={handleLayerDragMove}
                    onLayerContextMenu={handleLayerContextMenu}
                  />
                ))}
                
                {/* Playhead - 타임라인 전체에 걸친 세로선 */}
                <Playhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 레이어 컨텍스트 메뉴 */}
      {contextMenu && (
        <LayerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          layer={contextMenu.layer}
          onClose={handleCloseContextMenu}
          onBringToFront={handleBringToFront}
          onBringForward={handleBringForward}
          onSendToBack={handleSendToBack}
          onSendBackward={handleSendBackward}
          onDelete={handleDeleteLayer}
        />
      )}
    </div>
  );
}
