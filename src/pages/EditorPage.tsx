import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipBack, Square, Video, FileJson, Layers } from 'lucide-react';
import { Button, FrontView, TopViewEditor } from '@/components';
import { useProjectStore, useCurrentProject, useCurrentTime, useIsPlaying } from '@/stores';
import { cn, formatTimeWithMs, formatTime } from '@/lib/utils';
import { TRACK_COLORS, type TrackSlot, type Track, type Layer, type SkeletonJson } from '@/types';

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

// 레이어 블록 컴포넌트 (드래그 가능)
function LayerBlock({ 
  layer, 
  color, 
  pixelsPerSecond,
  onDragMove,
  isPatch = false,
}: { 
  layer: Layer; 
  color: string; 
  pixelsPerSecond: number;
  onDragMove?: (layerId: number, newStartSec: number) => void;
  isPatch?: boolean;
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
}: { 
  track: Track;
  duration: number;
  pixelsPerSecond: number;
  onLayerDragMove: (layerId: number, newStartSec: number) => void;
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
  const addPositionKeyframe = useProjectStore(state => state.addPositionKeyframe);

  // 타임라인 줌 상태
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  
  // Top View 모드 (재생/편집)
  const [topViewMode, setTopViewMode] = useState<'play' | 'edit'>('play');
  
  // 스켈레톤 데이터 캐시 (layerId → SkeletonJson)
  const [skeletonCache, setSkeletonCache] = useState<Map<number, SkeletonJson>>(new Map());
  
  // 줌 핸들러 (드래그 delta 기반)
  const handleZoom = useCallback((delta: number) => {
    setPixelsPerSecond(prev => {
      const newValue = prev + delta;
      return Math.min(MAX_PIXELS_PER_SECOND, Math.max(MIN_PIXELS_PER_SECOND, newValue));
    });
  }, []);
  
  // 스켈레톤 캐시에 추가
  const addToSkeletonCache = useCallback((layerId: number, data: SkeletonJson) => {
    setSkeletonCache(prev => new Map(prev).set(layerId, data));
  }, []);

  // 프로젝트 로드
  const getProjectById = useProjectStore(state => state.getProjectById);
  
  useEffect(() => {
    if (!projectId) return;
    
    const numericId = parseInt(projectId, 10);
    
    if (!project || project.id !== numericId) {
      // TODO: 백엔드 연동 시 API 호출로 대체
      // const editState = await projectApi.getEditState(numericId);
      // setCurrentProject(transformEditState(editState));
      
      // 임시: 프로젝트 데이터에서 찾기
      const foundProject = getProjectById(numericId);
      if (foundProject) {
        setCurrentProject(foundProject);
      } else {
        // 프로젝트를 찾을 수 없으면 목록으로 이동
        navigate('/');
      }
    }
  }, [projectId, project, getProjectById, setCurrentProject, navigate]);

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
  
  // 오디오 element 생성
  useEffect(() => {
    if (project?.music.objectKey) {
      const audio = new Audio(project.music.objectKey);
      audioRef.current = audio;
      
      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [project?.music.objectKey]);

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
  const handleUploadJson = useCallback((trackId: number, file: File) => {
    console.log(`Uploading skeleton JSON for Track ${trackId}:`, file.name);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
        console.log('JSON file size:', rawText.length, 'bytes');
        console.log('JSON preview:', rawText.substring(0, 200));
        
        const json = JSON.parse(rawText);
        console.log('Parsed JSON:', json);
        
        // 구조 검증
        if (!json.meta && !json.frames) {
          throw new Error('Invalid skeleton JSON: missing meta or frames');
        }
        
        const meta = json.meta || {};
        const frames = json.frames || [];
        
        console.log('Meta:', meta);
        console.log('Frames count:', frames.length);
        
        const fps = meta.fps || 24;
        const numFrames = frames.length || meta.num_frames_sampled || 0;
        const duration = numFrames / fps;
        
        if (numFrames === 0) {
          throw new Error('No frames found in skeleton JSON');
        }
        
        const track = project?.tracks.find(t => t.trackId === trackId);
        const lastEndTime = track?.layers.reduce((max, layer) => 
          Math.max(max, layer.endSec), 0
        ) ?? 0;
        
        const maxPriority = track?.layers.reduce((max, layer) => 
          Math.max(max, layer.priority), 0
        ) ?? 0;
        
        // TODO: 백엔드 연동 시 API 호출로 대체
        // 1. layerApi.initUpload() - presigned URL 발급
        // 2. uploadToMinIO() - MinIO에 JSON 업로드
        // 3. layerApi.create() - 레이어 생성 (SKELETON_JSON 타입)
        
        const layerId = Date.now();
        
        addLayer(trackId, {
          layerId,
          trackId,
          startSec: lastEndTime,
          endSec: lastEndTime + duration,
          priority: maxPriority + 1,
          label: file.name.replace(/\.[^/.]+$/, ''),
          fadeInSec: 0,
          fadeOutSec: 0,
          skeleton: {
            sourceId: Date.now(),
            status: 'READY', // JSON 직접 업로드는 바로 READY
            objectKey: null,
            fps,
            numFrames,
            numJoints: meta.num_joints || 33,
            poseModel: meta.pose_model || 'mediapipe_pose',
          },
        });
        
        // 스켈레톤 데이터를 캐시에 저장
        addToSkeletonCache(layerId, json as SkeletonJson);
        
        console.log(`✅ JSON loaded: ${numFrames} frames, ${duration.toFixed(1)}s, ${fps}fps`);
      } catch (err) {
        console.error('❌ Failed to parse skeleton JSON:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        alert(`스켈레톤 JSON 파일을 파싱할 수 없습니다.\n\n에러: ${errorMessage}`);
      }
    };
    
    reader.onerror = () => {
      console.error('Failed to read JSON file');
    };
    
    reader.readAsText(file);
  }, [project, addLayer, addToSkeletonCache]);

  // 패치 JSON 업로드 핸들러 (높은 priority로 추가, 현재 시간 위치에 배치)
  const handleUploadPatch = useCallback((trackId: number, file: File) => {
    console.log(`📌 Uploading PATCH for Track ${trackId}:`, file.name);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const rawText = e.target?.result as string;
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
        
        const layerId = Date.now();
        
        // store에서 최신 상태를 직접 가져와서 최대 priority 계산
        // (closure로 인해 project가 stale할 수 있으므로)
        const currentState = useProjectStore.getState();
        const latestProject = currentState.currentProject;
        const track = latestProject?.tracks.find(t => t.trackId === trackId);
        const maxPriority = track?.layers.reduce((max, layer) => 
          Math.max(max, layer.priority), PATCH_PRIORITY_THRESHOLD
        ) ?? PATCH_PRIORITY_THRESHOLD;
        
        console.log(`📊 Current max priority in track: ${maxPriority}, new patch will be: ${maxPriority + 1}`);
        
        // 패치는 항상 기존보다 높은 priority로 설정
        addLayer(trackId, {
          layerId,
          trackId,
          startSec: snappedStartTime,
          endSec: snappedStartTime + duration,
          priority: maxPriority + 1, // 항상 기존 최대 + 1
          label: `${file.name.replace(/\.[^/.]+$/, '')}`,
          fadeInSec: 0,
          fadeOutSec: 0,
          skeleton: {
            sourceId: Date.now(),
            status: 'READY',
            objectKey: null,
            fps,
            numFrames,
            numJoints: meta.num_joints || 33,
            poseModel: meta.pose_model || 'mediapipe_pose',
          },
        });
        
        addToSkeletonCache(layerId, json as SkeletonJson);
        
        console.log(`✅ PATCH loaded at ${snappedStartTime.toFixed(2)}s: ${numFrames} frames (${duration.toFixed(2)}s)`);
        console.log(`   → Drag to reposition, frames will snap to grid`);
      } catch (err) {
        console.error('❌ Failed to parse patch JSON:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        alert(`패치 JSON 파일을 파싱할 수 없습니다.\n\n에러: ${errorMessage}`);
      }
    };
    
    reader.readAsText(file);
  }, [currentTime, addLayer, addToSkeletonCache]);

  // 레이어 드래그 이동 핸들러
  const updateLayer = useProjectStore(state => state.updateLayer);
  
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

  // 각 트랙에서 현재 시간에 활성화된 레이어의 스켈레톤 데이터
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

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <p className="text-surface-400">프로젝트를 불러오는 중...</p>
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
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-surface-500 font-mono">
            {project.music.objectKey?.split('/').pop() || 'No music'}
          </span>
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
                  />
                ))}
                
                {/* Playhead - 타임라인 전체에 걸친 세로선 */}
                <Playhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
