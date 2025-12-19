import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Music, Users, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { useProjectStore } from '@/stores';
import { projectApi } from '@/lib/api';
import { cn, formatTime } from '@/lib/utils';

export default function ProjectListPage() {
  const navigate = useNavigate();
  const projects = useProjectStore(state => state.projects);
  const setProjects = useProjectStore(state => state.setProjects);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 프로젝트 목록 로드
  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await projectApi.list();
      setProjects(response.items.map(item => ({
        projectId: item.id,
        title: item.title,
        musicDurationSec: item.music_duration_sec ? Number(item.music_duration_sec) : null,
        createdAt: item.created_at,
      })));
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err instanceof Error ? err.message : '프로젝트 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="min-h-screen bg-surface-900">
      {/* 배경 그라데이션 */}
      <div className="fixed inset-0 bg-gradient-to-br from-accent-900/20 via-transparent to-dancer-1/10 pointer-events-none" />
      
      {/* 헤더 */}
      <header className="relative border-b border-surface-700 bg-surface-900/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-surface-300 bg-clip-text text-transparent">
                Collabography
              </h1>
              <p className="mt-1 text-surface-400 text-sm">
                Asynchronous Dance Collaboration Tool
              </p>
            </div>
            
            <Button
              size="lg"
              onClick={() => navigate('/project/new')}
              className="gap-2"
            >
              <Plus className="w-5 h-5" />
              새 프로젝트
            </Button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {isLoading ? (
          // 로딩 상태
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-12 h-12 text-accent-500 animate-spin mb-4" />
            <p className="text-surface-400">프로젝트 목록을 불러오는 중...</p>
          </div>
        ) : error ? (
          // 에러 상태
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-24 h-24 rounded-full bg-red-900/30 flex items-center justify-center mb-6">
              <RefreshCw className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-surface-200 mb-2">
              불러오기 실패
            </h2>
            <p className="text-surface-400 mb-8 text-center max-w-md">
              {error}
            </p>
            <Button
              size="lg"
              onClick={loadProjects}
              className="gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              다시 시도
            </Button>
          </div>
        ) : projects.length === 0 ? (
          // 빈 상태
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-24 h-24 rounded-full bg-surface-800 flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-surface-500" />
            </div>
            <h2 className="text-xl font-semibold text-surface-200 mb-2">
              아직 프로젝트가 없습니다
            </h2>
            <p className="text-surface-400 mb-8 text-center max-w-md">
              새 프로젝트를 만들어 여러 댄서의 영상을 하나의 군무로 조합해보세요.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/project/new')}
              className="gap-2"
            >
              <Plus className="w-5 h-5" />
              첫 프로젝트 만들기
            </Button>
          </div>
        ) : (
          // 프로젝트 그리드
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <Card
                key={project.projectId}
                variant="interactive"
                onClick={() => navigate(`/project/${project.projectId}`)}
                className={cn(
                  'animate-slide-up',
                  'group overflow-hidden'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* 썸네일 영역 */}
                <div className="aspect-video bg-surface-900 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-600/20 to-dancer-1/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex gap-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-4 h-4 rounded-full',
                            i === 1 && 'bg-dancer-1',
                            i === 2 && 'bg-dancer-2',
                            i === 3 && 'bg-dancer-3',
                            'opacity-60 group-hover:opacity-100 transition-opacity'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <CardContent>
                  <h3 className="font-semibold text-surface-100 mb-3 group-hover:text-white transition-colors">
                    {project.title}
                  </h3>
                  
                  <div className="space-y-2 text-sm text-surface-400">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      <span>
                        {project.musicDurationSec 
                          ? formatTime(project.musicDurationSec)
                          : '음악 없음'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>3명의 댄서</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
