import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipBack, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { useProjectStore, useCurrentProject, useCurrentTime, useIsPlaying } from '@/stores';
import { cn, formatTimeWithMs, formatTime } from '@/lib/utils';
import { DANCER_COLORS, type DancerId, type Dancer, type Segment } from '@/types';

// 타임라인 설정
const PIXELS_PER_SECOND = 50; // 1초당 50px
const TRACK_LABEL_WIDTH = 176; // w-44 = 11rem = 176px

// 임시 플레이스홀더 컴포넌트들
function TopViewPlaceholder() {
  return (
    <div className="h-full bg-surface-900 rounded-lg border border-surface-700 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center gap-4 mb-4">
          {([1, 2, 3] as DancerId[]).map((id) => (
            <div
              key={id}
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: DANCER_COLORS[id] }}
            />
          ))}
        </div>
        <p className="text-surface-400 text-sm">Top View</p>
        <p className="text-surface-500 text-xs mt-1">위에서 본 댄서 배치</p>
      </div>
    </div>
  );
}

function FrontViewPlaceholder() {
  return (
    <div className="h-full bg-surface-900 rounded-lg border border-surface-700 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center gap-6 mb-4">
          {([1, 2, 3] as DancerId[]).map((id) => (
            <div key={id} className="flex flex-col items-center gap-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: DANCER_COLORS[id] }}
              />
              <div
                className="w-0.5 h-10"
                style={{ backgroundColor: DANCER_COLORS[id] }}
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

// 타임라인 눈금자 (내용 영역만)
function TimelineRulerContent({ duration }: { duration: number }) {
  const totalWidth = duration * PIXELS_PER_SECOND;
  
  // 눈금 간격 계산 (5초 단위 주요 눈금, 1초 단위 보조 눈금)
  const majorInterval = 5;
  const minorInterval = 1;
  
  const majorTicks: number[] = [];
  const minorTicks: number[] = [];
  
  for (let t = 0; t <= duration; t += minorInterval) {
    if (t % majorInterval === 0) {
      majorTicks.push(t);
    } else {
      minorTicks.push(t);
    }
  }

  return (
    <div 
      className="h-8 bg-surface-900/30 relative"
      style={{ width: totalWidth }}
    >
      {/* 보조 눈금 (1초 단위) */}
      {minorTicks.map((t) => (
        <div
          key={`minor-${t}`}
          className="absolute top-0 w-px h-2 bg-surface-600"
          style={{ left: t * PIXELS_PER_SECOND }}
        />
      ))}
      
      {/* 주요 눈금 (5초 단위) */}
      {majorTicks.map((t) => (
        <div
          key={`major-${t}`}
          className="absolute top-0 flex flex-col items-start"
          style={{ left: t * PIXELS_PER_SECOND }}
        >
          <div className="w-px h-4 bg-surface-500" />
          <span className="text-[10px] text-surface-500 font-mono ml-1 whitespace-nowrap">
            {formatTime(t)}
          </span>
        </div>
      ))}
    </div>
  );
}

// 세그먼트 블록 컴포넌트
function SegmentBlock({ segment, color }: { segment: Segment; color: string }) {
  const width = segment.duration * PIXELS_PER_SECOND;
  const left = segment.startTime * PIXELS_PER_SECOND;

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 rounded',
        'border flex items-center px-2 overflow-hidden',
        segment.isProcessing && 'animate-pulse'
      )}
      style={{
        left,
        width,
        backgroundColor: `${color}30`,
        borderColor: `${color}60`,
      }}
      title={`${segment.name} (${segment.duration.toFixed(1)}s)`}
    >
      <span 
        className="text-xs font-medium truncate"
        style={{ color }}
      >
        {segment.name}
      </span>
    </div>
  );
}

// 댄서 트랙 레이블
function DancerTrackLabel({ 
  dancer,
  onUploadVideo,
}: { 
  dancer: Dancer;
  onUploadVideo: (dancerId: DancerId, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const color = DANCER_COLORS[dancer.id];
  const segmentCount = dancer.track.segments.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadVideo(dancer.id, file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="h-14 px-3 flex items-center gap-2 border-b border-r border-surface-700 bg-surface-800">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-surface-300 truncate flex-1">
        {dancer.name}
      </span>
      
      {/* 업로드 버튼 */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        title={segmentCount > 0 ? '영상 변경' : '영상 업로드'}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded transition-all',
          segmentCount > 0 
            ? 'bg-surface-700/50 hover:bg-surface-600 text-surface-200 hover:text-white'
            : 'bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-white',
          'border border-surface-600 hover:border-surface-500'
        )}
        style={{ 
          boxShadow: segmentCount > 0 ? `0 0 10px ${color}50` : undefined,
          borderColor: segmentCount > 0 ? `${color}50` : undefined,
          color: segmentCount > 0 ? color : undefined,
        }}
      >
        {segmentCount > 0 ? (
          <RefreshCw className="w-3.5 h-3.5" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// 댄서 트랙 내용
function DancerTrackContent({ 
  dancer,
  duration,
}: { 
  dancer: Dancer;
  duration: number;
}) {
  const color = DANCER_COLORS[dancer.id];
  const totalWidth = duration * PIXELS_PER_SECOND;

  return (
    <div 
      className="h-14 bg-surface-900/50 relative timeline-grid border-b border-surface-700"
      style={{ width: totalWidth }}
    >
      {/* 세그먼트 블록들 */}
      {dancer.track.segments.map((segment) => (
        <SegmentBlock key={segment.id} segment={segment} color={color} />
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
function MusicTrackContent({ duration, musicDuration }: { duration: number; musicDuration: number }) {
  const totalWidth = duration * PIXELS_PER_SECOND;
  const musicWidth = musicDuration * PIXELS_PER_SECOND;
  
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

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const project = useCurrentProject();
  const currentTime = useCurrentTime();
  const isPlaying = useIsPlaying();
  const projects = useProjectStore(state => state.projects);
  const setCurrentProject = useProjectStore(state => state.setCurrentProject);
  const setCurrentTime = useProjectStore(state => state.setCurrentTime);
  const togglePlayback = useProjectStore(state => state.togglePlayback);
  const addSegment = useProjectStore(state => state.addSegment);

  // 프로젝트 로드
  useEffect(() => {
    if (!projectId) return;
    
    // 현재 프로젝트가 없거나 다른 프로젝트면 로드
    if (!project || project.id !== projectId) {
      const found = projects.find(p => p.id === projectId);
      if (found) {
        setCurrentProject(found);
      } else {
        // 프로젝트를 찾을 수 없으면 목록으로
        navigate('/');
      }
    }
  }, [projectId, project, projects, setCurrentProject, navigate]);

  // 동영상 업로드 핸들러 - 영상 길이 자동 파악
  const handleUploadVideo = useCallback((dancerId: DancerId, file: File) => {
    console.log(`Uploading video for Dancer ${dancerId}:`, file.name);
    
    const videoUrl = URL.createObjectURL(file);
    
    // 비디오 요소를 만들어서 duration 파악
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      console.log(`Video duration: ${duration}s`);
      
      // 현재 댄서의 마지막 세그먼트 종료 시간 계산
      const dancer = project?.dancers.find(d => d.id === dancerId);
      const lastEndTime = dancer?.track.segments.reduce((max, seg) => {
        return Math.max(max, seg.startTime + seg.duration);
      }, 0) ?? 0;
      
      addSegment(dancerId, {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, ''), // 확장자 제거
        startTime: lastEndTime, // 이전 세그먼트 뒤에 배치
        duration: duration,
        skeletonData: null, // TODO: 백엔드에서 스켈레톤 추출 후 채워짐
        videoUrl,
        isProcessing: true,
      });
      
      // 정리
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      console.error('Failed to load video metadata');
      URL.revokeObjectURL(videoUrl);
    };
    
    video.src = videoUrl;
  }, [project, addSegment]);

  // 타임라인 전체 길이 계산 (음악 + 모든 댄서 세그먼트 중 최대값)
  const timelineDuration = useMemo(() => {
    if (!project) return 0;
    
    // 각 댄서의 마지막 세그먼트 종료 시간
    const dancerEndTimes = project.dancers.map(dancer => 
      dancer.track.segments.reduce((max, seg) => 
        Math.max(max, seg.startTime + seg.duration), 0
      )
    );
    
    // 음악 길이와 모든 댄서 종료 시간 중 최대값
    return Math.max(project.musicDuration, ...dancerEndTimes);
  }, [project]);

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
          {project.name}
        </h1>
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-surface-500 font-mono">
            {project.musicName}
          </span>
        </div>
      </header>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 프리뷰 영역 (Top + Front View) */}
        <div className="flex-1 min-h-0 p-4 flex gap-4">
          <div className="flex-1 min-w-0">
            <TopViewPlaceholder />
          </div>
          <div className="flex-1 min-w-0">
            <FrontViewPlaceholder />
          </div>
        </div>

        {/* 타임라인 영역 */}
        <div className="flex-shrink-0 border-t border-surface-700 bg-surface-800/30">
          {/* 재생 컨트롤 */}
          <div className="h-12 border-b border-surface-700 flex items-center px-4 gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentTime(0)}
                className="w-8 h-8 p-0"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayback}
                className={cn(
                  'w-10 h-10 p-0 rounded-full',
                  isPlaying && 'bg-accent-600 hover:bg-accent-500'
                )}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </Button>
            </div>
            
            <div className="font-mono text-sm text-surface-300">
              <span className="text-white">{formatTimeWithMs(currentTime)}</span>
              <span className="text-surface-500 mx-1">/</span>
              <span>{formatTimeWithMs(project.musicDuration)}</span>
            </div>
          </div>

          {/* 타임라인 */}
          <div className="flex max-h-72">
            {/* 왼쪽: 트랙 레이블 (고정) */}
            <div className="w-44 flex-shrink-0 overflow-y-auto">
              <RulerLabel />
              <MusicTrackLabel />
              {project.dancers.map((dancer) => (
                <DancerTrackLabel
                  key={dancer.id}
                  dancer={dancer}
                  onUploadVideo={handleUploadVideo}
                />
              ))}
            </div>
            
            {/* 오른쪽: 타임라인 내용 (스크롤 가능) */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div style={{ minWidth: timelineDuration * PIXELS_PER_SECOND }}>
                <TimelineRulerContent duration={timelineDuration} />
                <MusicTrackContent duration={timelineDuration} musicDuration={project.musicDuration} />
                {project.dancers.map((dancer) => (
                  <DancerTrackContent
                    key={dancer.id}
                    dancer={dancer}
                    duration={timelineDuration}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

