import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/shallow';
import type { 
  Project, 
  Track, 
  Layer, 
  PositionKeyframe,
  TrackSlot,
  Music,
  AssetStatus,
  SkeletonSource,
} from '@/types';

// ============================================
// State Interface
// ============================================

interface ProjectState {
  // 프로젝트 목록 (Project List Page)
  projects: Array<{
    projectId: number;
    title: string;
    musicDurationSec: number | null;
    createdAt: string;
  }>;
  
  // 전체 프로젝트 데이터 캐시 (projectId → Project)
  projectsData: Record<number, Project>;
  
  // 현재 편집 중인 프로젝트 (Edit Page)
  currentProject: Project | null;
  
  // 재생 상태 (로컬)
  currentTime: number;
  isPlaying: boolean;
  
  // 로딩 상태
  isLoading: boolean;
  error: string | null;

  // ============================================
  // Actions - 프로젝트 목록
  // ============================================
  
  setProjects: (projects: ProjectState['projects']) => void;
  
  // ============================================
  // Actions - 현재 프로젝트
  // ============================================
  
  setCurrentProject: (project: Project | null) => void;
  updateProjectTitle: (title: string) => void;
  updateMusic: (music: Music) => void;
  
  // ============================================
  // Actions - 재생 컨트롤
  // ============================================
  
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlayback: () => void;
  
  // ============================================
  // Actions - Layer 관리
  // ============================================
  
  addLayer: (trackId: number, layer: Layer) => void;
  updateLayer: (layerId: number, updates: Partial<Layer>) => void;
  removeLayer: (layerId: number) => void;
  updateLayerStatus: (layerId: number, status: AssetStatus, objectKey?: string) => void;
  
  // ============================================
  // Actions - Position Keyframe 관리
  // ============================================
  
  setPositionKeyframes: (trackId: number, keyframes: PositionKeyframe[]) => void;
  addPositionKeyframe: (trackId: number, keyframe: PositionKeyframe) => void;
  updatePositionKeyframe: (trackId: number, keyframeId: number, updates: Partial<PositionKeyframe>) => void;
  removePositionKeyframe: (trackId: number, keyframeId: number) => void;
  
  // ============================================
  // Actions - 유틸리티
  // ============================================
  
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getTrackBySlot: (slot: TrackSlot) => Track | undefined;
  
  // ============================================
  // Actions - 임시 (백엔드 연동 전)
  // ============================================
  
  createTempProject: (title: string, musicObjectKey: string, musicDuration: number) => Project;
  getProjectById: (projectId: number) => Project | null;
}

// ============================================
// Helper Functions
// ============================================

// 댄서별 mock position keyframes
const MOCK_POSITION_KEYFRAMES: Record<TrackSlot, PositionKeyframe[]> = {
  // Dancer 1: 왼쪽에서 시작, 대각선으로 중앙, 오른쪽으로 이동
  1: [
    { id: 101, timeSec: 0.0, x: 0.2, y: 0.7, interp: 'LINEAR' },
    { id: 102, timeSec: 1.5, x: 0.35, y: 0.4, interp: 'LINEAR' },
    { id: 103, timeSec: 3.0, x: 0.5, y: 0.5, interp: 'LINEAR' },
    { id: 104, timeSec: 4.5, x: 0.65, y: 0.3, interp: 'LINEAR' },
    { id: 105, timeSec: 6.0, x: 0.4, y: 0.6, interp: 'LINEAR' },
  ],
  // Dancer 2: 중앙에서 시작, 앞뒤로 이동
  2: [
    { id: 201, timeSec: 0.0, x: 0.5, y: 0.3, interp: 'LINEAR' },
    { id: 202, timeSec: 1.5, x: 0.5, y: 0.6, interp: 'LINEAR' },
    { id: 203, timeSec: 3.0, x: 0.4, y: 0.4, interp: 'LINEAR' },
    { id: 204, timeSec: 4.5, x: 0.6, y: 0.5, interp: 'LINEAR' },
    { id: 205, timeSec: 6.0, x: 0.5, y: 0.35, interp: 'LINEAR' },
  ],
  // Dancer 3: 오른쪽에서 시작, 원형으로 이동
  3: [
    { id: 301, timeSec: 0.0, x: 0.8, y: 0.5, interp: 'LINEAR' },
    { id: 302, timeSec: 1.5, x: 0.7, y: 0.3, interp: 'LINEAR' },
    { id: 303, timeSec: 3.0, x: 0.5, y: 0.25, interp: 'LINEAR' },
    { id: 304, timeSec: 4.5, x: 0.3, y: 0.4, interp: 'LINEAR' },
    { id: 305, timeSec: 6.0, x: 0.6, y: 0.65, interp: 'LINEAR' },
  ],
};

// 빈 트랙 생성 (mock position keyframes 포함)
const createEmptyTrack = (trackId: number, slot: TrackSlot): Track => ({
  trackId,
  slot,
  displayName: `Dancer ${slot}`,
  layers: [],
  positionKeyframes: MOCK_POSITION_KEYFRAMES[slot],
});

// 새 프로젝트 생성 (임시, 백엔드 연동 전)
const createNewProject = (
  id: number,
  title: string,
  musicObjectKey: string,
  musicDuration: number
): Project => ({
  id,
  title,
  music: {
    objectKey: musicObjectKey,
    durationSec: musicDuration,
    bpm: null,
  },
  tracks: [
    createEmptyTrack(id * 10 + 1, 1),
    createEmptyTrack(id * 10 + 2, 2),
    createEmptyTrack(id * 10 + 3, 3),
  ],
  createdAt: new Date().toISOString(),
});

// ============================================
// Store
// ============================================

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    projects: [],
    projectsData: {},
    currentProject: null,
    currentTime: 0,
    isPlaying: false,
    isLoading: false,
    error: null,

    // ============================================
    // 프로젝트 목록
    // ============================================
    
    setProjects: (projects) => set({ projects }),

    // ============================================
    // 현재 프로젝트
    // ============================================
    
    setCurrentProject: (project) => set({ 
      currentProject: project,
      currentTime: 0,
      isPlaying: false,
      error: null,
    }),
    
    updateProjectTitle: (title) => set((state) => {
      if (state.currentProject) {
        state.currentProject.title = title;
      }
    }),
    
    updateMusic: (music) => set((state) => {
      if (state.currentProject) {
        state.currentProject.music = music;
      }
    }),

    // ============================================
    // 재생 컨트롤
    // ============================================
    
    setCurrentTime: (time) => set({ currentTime: time }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

    // ============================================
    // Layer 관리
    // ============================================
    
    addLayer: (trackId, layer) => set((state) => {
      if (!state.currentProject) return;
      
      const track = state.currentProject.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.layers.push(layer);
      }
    }),
    
    updateLayer: (layerId, updates) => set((state) => {
      if (!state.currentProject) return;
      
      for (const track of state.currentProject.tracks) {
        const layer = track.layers.find(l => l.layerId === layerId);
        if (layer) {
          Object.assign(layer, updates);
          break;
        }
      }
    }),
    
    removeLayer: (layerId) => set((state) => {
      if (!state.currentProject) return;
      
      for (const track of state.currentProject.tracks) {
        const idx = track.layers.findIndex(l => l.layerId === layerId);
        if (idx !== -1) {
          track.layers.splice(idx, 1);
          break;
        }
      }
    }),
    
    updateLayerStatus: (layerId, status, objectKey) => set((state) => {
      if (!state.currentProject) return;
      
      for (const track of state.currentProject.tracks) {
        const layer = track.layers.find(l => l.layerId === layerId);
        if (layer) {
          layer.skeleton.status = status;
          if (objectKey) {
            layer.skeleton.objectKey = objectKey;
          }
          break;
        }
      }
    }),

    // ============================================
    // Position Keyframe 관리
    // ============================================
    
    setPositionKeyframes: (trackId, keyframes) => set((state) => {
      if (!state.currentProject) return;
      
      const track = state.currentProject.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.positionKeyframes = keyframes;
      }
    }),
    
    addPositionKeyframe: (trackId, keyframe) => set((state) => {
      if (!state.currentProject) return;
      
      const track = state.currentProject.tracks.find(t => t.trackId === trackId);
      if (track) {
        // 같은 시간에 기존 키프레임이 있으면 업데이트
        const existingIdx = track.positionKeyframes.findIndex(
          k => Math.abs(k.timeSec - keyframe.timeSec) < 0.01
        );
        
        if (existingIdx >= 0) {
          track.positionKeyframes[existingIdx] = keyframe;
        } else {
          track.positionKeyframes.push(keyframe);
          track.positionKeyframes.sort((a, b) => a.timeSec - b.timeSec);
        }
      }
    }),
    
    updatePositionKeyframe: (trackId, keyframeId, updates) => set((state) => {
      if (!state.currentProject) return;
      
      const track = state.currentProject.tracks.find(t => t.trackId === trackId);
      if (track) {
        const keyframe = track.positionKeyframes.find(k => k.id === keyframeId);
        if (keyframe) {
          Object.assign(keyframe, updates);
        }
      }
    }),
    
    removePositionKeyframe: (trackId, keyframeId) => set((state) => {
      if (!state.currentProject) return;
      
      const track = state.currentProject.tracks.find(t => t.trackId === trackId);
      if (track) {
        track.positionKeyframes = track.positionKeyframes.filter(k => k.id !== keyframeId);
      }
    }),

    // ============================================
    // 유틸리티
    // ============================================
    
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    getTrackBySlot: (slot) => {
      const { currentProject } = get();
      return currentProject?.tracks.find(t => t.slot === slot);
    },

    // ============================================
    // 임시 (백엔드 연동 전)
    // ============================================
    
    createTempProject: (title, musicObjectKey, musicDuration) => {
      const id = Date.now();
      const newProject = createNewProject(id, title, musicObjectKey, musicDuration);
      
      set((state) => {
        state.projects.push({
          projectId: id,
          title,
          musicDurationSec: musicDuration,
          createdAt: newProject.createdAt,
        });
        // 전체 프로젝트 데이터도 저장
        state.projectsData[id] = newProject;
      });
      
      return newProject;
    },
    
    // projectId로 프로젝트 가져오기
    getProjectById: (projectId: number) => {
      return get().projectsData[projectId] || null;
    },
  }))
);

// ============================================
// Selectors
// ============================================

export const useCurrentProject = () => useProjectStore(state => state.currentProject);
export const useProjects = () => useProjectStore(state => state.projects);
export const useCurrentTime = () => useProjectStore(state => state.currentTime);
export const useIsPlaying = () => useProjectStore(state => state.isPlaying);
export const useIsLoading = () => useProjectStore(state => state.isLoading);
export const useError = () => useProjectStore(state => state.error);

// 여러 값을 한번에 가져올 때는 useShallow 사용
export const usePlaybackState = () => useProjectStore(
  useShallow(state => ({
    currentTime: state.currentTime,
    isPlaying: state.isPlaying,
  }))
);

// 특정 트랙 가져오기
export const useTrack = (slot: TrackSlot) => useProjectStore(
  state => state.currentProject?.tracks.find(t => t.slot === slot)
);
