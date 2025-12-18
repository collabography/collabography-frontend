import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/shallow';
import type { Project, Segment, DancerId, DancerPosition } from '@/types';

interface ProjectState {
  // 프로젝트 목록
  projects: Project[];
  
  // 현재 편집 중인 프로젝트
  currentProject: Project | null;
  
  // 재생 상태
  currentTime: number;
  isPlaying: boolean;
  
  // 액션들
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  
  // 재생 컨트롤
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlayback: () => void;
  
  // 세그먼트 관리
  addSegment: (dancerId: DancerId, segment: Segment) => void;
  removeSegment: (dancerId: DancerId, segmentId: string) => void;
  updateSegment: (dancerId: DancerId, segmentId: string, updates: Partial<Segment>) => void;
  
  // 댄서 위치 관리
  updateDancerPosition: (dancerId: DancerId, position: DancerPosition) => void;
  
  // 프로젝트 관리
  createProject: (name: string, musicUrl: string, musicDuration: number, musicName: string) => Project;
  deleteProject: (projectId: string) => void;
}

// 빈 댄서 생성 헬퍼
const createEmptyDancer = (id: DancerId): Dancer => ({
  id,
  name: `Dancer ${id}`,
  track: {
    id: `track-${id}`,
    dancerId: id,
    segments: [],
  },
  positions: [{ time: 0, x: (id - 2) * 0.3, y: 0 }], // 초기 위치: 가로로 나란히
});

// 새 프로젝트 생성 헬퍼
const createNewProject = (
  name: string,
  musicUrl: string,
  musicDuration: number,
  musicName: string
): Project => ({
  id: crypto.randomUUID(),
  name,
  createdAt: new Date(),
  updatedAt: new Date(),
  musicUrl,
  musicDuration,
  musicName,
  dancers: [
    createEmptyDancer(1),
    createEmptyDancer(2),
    createEmptyDancer(3),
  ],
  currentTime: 0,
  isPlaying: false,
});

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    projects: [],
    currentProject: null,
    currentTime: 0,
    isPlaying: false,

    setProjects: (projects) => set({ projects }),
    
    setCurrentProject: (project) => set({ 
      currentProject: project,
      currentTime: project?.currentTime ?? 0,
      isPlaying: false,
    }),

    setCurrentTime: (time) => set((state) => {
      state.currentTime = time;
      if (state.currentProject) {
        state.currentProject.currentTime = time;
      }
    }),

    setIsPlaying: (isPlaying) => set({ isPlaying }),
    
    togglePlayback: () => set((state) => {
      state.isPlaying = !state.isPlaying;
    }),

    addSegment: (dancerId, segment) => set((state) => {
      if (!state.currentProject) return;
      
      const dancer = state.currentProject.dancers.find(d => d.id === dancerId);
      if (dancer) {
        dancer.track.segments.push(segment);
        state.currentProject.updatedAt = new Date();
      }
    }),

    removeSegment: (dancerId, segmentId) => set((state) => {
      if (!state.currentProject) return;
      
      const dancer = state.currentProject.dancers.find(d => d.id === dancerId);
      if (dancer) {
        dancer.track.segments = dancer.track.segments.filter(s => s.id !== segmentId);
        state.currentProject.updatedAt = new Date();
      }
    }),

    updateSegment: (dancerId, segmentId, updates) => set((state) => {
      if (!state.currentProject) return;
      
      const dancer = state.currentProject.dancers.find(d => d.id === dancerId);
      if (dancer) {
        const segment = dancer.track.segments.find(s => s.id === segmentId);
        if (segment) {
          Object.assign(segment, updates);
          state.currentProject.updatedAt = new Date();
        }
      }
    }),

    updateDancerPosition: (dancerId, position) => set((state) => {
      if (!state.currentProject) return;
      
      const dancer = state.currentProject.dancers.find(d => d.id === dancerId);
      if (dancer) {
        // 같은 시간의 기존 위치가 있으면 업데이트, 없으면 추가
        const existingIdx = dancer.positions.findIndex(
          p => Math.abs(p.time - position.time) < 0.1
        );
        
        if (existingIdx >= 0) {
          dancer.positions[existingIdx] = position;
        } else {
          dancer.positions.push(position);
          dancer.positions.sort((a, b) => a.time - b.time);
        }
        
        state.currentProject.updatedAt = new Date();
      }
    }),

    createProject: (name, musicUrl, musicDuration, musicName) => {
      const newProject = createNewProject(name, musicUrl, musicDuration, musicName);
      
      set((state) => {
        state.projects.push(newProject);
      });
      
      return newProject;
    },

    deleteProject: (projectId) => set((state) => {
      state.projects = state.projects.filter(p => p.id !== projectId);
      if (state.currentProject?.id === projectId) {
        state.currentProject = null;
      }
    }),
  }))
);

// 셀렉터들
export const useCurrentProject = () => useProjectStore(state => state.currentProject);
export const useProjects = () => useProjectStore(state => state.projects);
export const useCurrentTime = () => useProjectStore(state => state.currentTime);
export const useIsPlaying = () => useProjectStore(state => state.isPlaying);

// 여러 값을 한번에 가져올 때는 useShallow 사용
export const usePlaybackState = () => useProjectStore(
  useShallow(state => ({
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
  }))
);

