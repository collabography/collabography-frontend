import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Music, ArrowLeft, Play, Pause, Check, Loader2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useProjectStore } from '@/stores';
import { projectApi, musicApi } from '@/lib/api';
import { cn, formatTime, formatFileSize } from '@/lib/utils';

export default function MusicSelectPage() {
  const navigate = useNavigate();
  const setCurrentProject = useProjectStore(state => state.setCurrentProject);
  
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('audio/')) {
      alert('오디오 파일만 업로드 가능합니다.');
      return;
    }

    // 이전 URL 정리
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    const url = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setAudioUrl(url);
    // 프로젝트 이름이 비어있을 때만 파일명으로 자동 설정
    if (!projectName.trim()) {
      setProjectName(selectedFile.name.replace(/\.[^/.]+$/, '')); // 확장자 제거
    }
  }, [audioUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleCreate = async () => {
    if (!file || !audioUrl || !projectName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // 1. 프로젝트 생성
      console.log('📦 Creating project:', projectName.trim());
      const projectResponse = await projectApi.create(projectName.trim());
      const projectId = projectResponse.id;
      console.log('✅ Project created:', projectId);

      // 2. 음악 파일 업로드 (multipart/form-data)
      console.log('🎵 Uploading music file...');
      const uploadResponse = await musicApi.upload(projectId, file, duration);
      console.log('✅ Music uploaded:', uploadResponse.object_key);

      // 3. 에디터 페이지로 이동
      navigate(`/project/${projectId}`);
      
    } catch (err) {
      console.error('❌ Failed to create project:', err);
      setCreateError(err instanceof Error ? err.message : '프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900">
      {/* 배경 */}
      <div className="fixed inset-0 bg-gradient-to-br from-accent-900/10 via-transparent to-transparent pointer-events-none" />
      
      {/* 헤더 */}
      <header className="relative border-b border-surface-700 bg-surface-900/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            프로젝트 목록
          </button>
          
          <h1 className="text-2xl font-bold text-white">
            새 프로젝트 만들기
          </h1>
          <p className="mt-1 text-surface-400">
            군무의 기준이 될 음악을 업로드하세요
          </p>
        </div>
      </header>

      {/* 메인 */}
      <main className="relative max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* 프로젝트 이름 */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">
              프로젝트 이름
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="예: 2024 공연 군무"
              className={cn(
                'w-full px-4 py-3 rounded-lg',
                'bg-surface-800 border border-surface-700',
                'text-white placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent',
                'transition-all'
              )}
            />
          </div>

          {/* 음악 업로드 */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">
              음악 파일
            </label>
            
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            {!file ? (
              // 업로드 드롭존
              <Card
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  'border-2 border-dashed',
                  isDragOver 
                    ? 'border-accent-500 bg-accent-500/10' 
                    : 'border-surface-600 hover:border-surface-500'
                )}
              >
                <div className="flex flex-col items-center justify-center py-16">
                  <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mb-4',
                    'bg-surface-700 transition-colors',
                    isDragOver && 'bg-accent-600'
                  )}>
                    <Upload className="w-8 h-8 text-surface-400" />
                  </div>
                  <p className="text-surface-300 font-medium mb-1">
                    음악 파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-surface-500 text-sm">
                    MP3, WAV, AAC 등 지원
                  </p>
                </div>
              </Card>
            ) : (
              // 업로드된 파일 정보
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-accent-600/20 flex items-center justify-center flex-shrink-0">
                    <Music className="w-7 h-7 text-accent-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-surface-400">
                      <span>{formatFileSize(file.size)}</span>
                      {duration > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatTime(duration)}</span>
                        </>
                      )}
                    </div>
                    
                    {/* 미리듣기 컨트롤 */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={togglePlayback}
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          'bg-accent-600 hover:bg-accent-500 transition-colors',
                          'text-white'
                        )}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          if (audioUrl) URL.revokeObjectURL(audioUrl);
                          setFile(null);
                          setAudioUrl(null);
                          setDuration(0);
                          setIsPlaying(false);
                        }}
                        className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
                      >
                        다른 파일 선택
                      </button>
                    </div>
                  </div>
                </div>
                
                <audio
                  ref={audioRef}
                  src={audioUrl || undefined}
                  onLoadedMetadata={handleAudioLoaded}
                  onEnded={() => setIsPlaying(false)}
                />
              </Card>
            )}
          </div>

          {/* 에러 메시지 */}
          {createError && (
            <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-300">
              <p className="text-sm">{createError}</p>
            </div>
          )}

          {/* 확인 버튼 */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              disabled={isCreating}
            >
              취소
            </Button>
            <Button
              disabled={!file || !projectName.trim() || isCreating}
              onClick={handleCreate}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  프로젝트 생성
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
