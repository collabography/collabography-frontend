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

/**
 * 초기 Position Keyframes (빈 상태)
 * - 각 댄서에 시작 위치(0초)만 설정
 * - 편집 모드에서 추가 키프레임 생성 가능
 */
const MOCK_POSITION_KEYFRAMES: Record<TrackSlot, PositionKeyframe[]> = {
  1: [{ id: 101, timeSec: 0.0, x: 0.25, y: 0.5, interp: 'STEP' }],  // Dancer 1: 왼쪽
  2: [{ id: 201, timeSec: 0.0, x: 0.5, y: 0.5, interp: 'STEP' }],   // Dancer 2: 중앙
  3: [{ id: 301, timeSec: 0.0, x: 0.75, y: 0.5, interp: 'STEP' }],  // Dancer 3: 오른쪽
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
        const TRANSITION_DURATION = 0.5; // 이동에 걸리는 시간 (초)
        
        // 같은 시간에 기존 키프레임이 있으면 업데이트
        const existingIdx = track.positionKeyframes.findIndex(
          k => Math.abs(k.timeSec - keyframe.timeSec) < 0.01
        );
        
        if (existingIdx >= 0) {
          // 기존 STEP 키프레임 업데이트
          track.positionKeyframes[existingIdx] = keyframe;
        } else {
          // 새 STEP 키프레임 추가
          track.positionKeyframes.push(keyframe);
          track.positionKeyframes.sort((a, b) => a.timeSec - b.timeSec);
          
          // === 자동 LINEAR 삽입 로직 ===
          // 이전 STEP 키프레임 찾기
          const sortedSteps = track.positionKeyframes
            .filter(k => k.interp === 'STEP')
            .sort((a, b) => a.timeSec - b.timeSec);
          
          const newStepIdx = sortedSteps.findIndex(k => k.id === keyframe.id);
          
          // 첫 번째가 아니고, 이전 STEP과 충분한 간격이 있으면
          if (newStepIdx > 0) {
            const prevStep = sortedSteps[newStepIdx - 1];
            const gap = keyframe.timeSec - prevStep.timeSec;
            
            // 0.5초 이상 간격이 있을 때만 LINEAR 삽입
            if (gap > TRANSITION_DURATION) {
              const linearTime = keyframe.timeSec - TRANSITION_DURATION;
              
              // 해당 시간에 이미 LINEAR가 있는지 확인
              const existingLinear = track.positionKeyframes.find(
                k => k.interp === 'LINEAR' && Math.abs(k.timeSec - linearTime) < 0.01
              );
              
              if (!existingLinear) {
                // LINEAR 키프레임 자동 추가 (x, y 없음)
                track.positionKeyframes.push({
                  id: Date.now() + Math.random() * 1000, // 유니크 ID
                  timeSec: linearTime,
                  interp: 'LINEAR',
                });
                track.positionKeyframes.sort((a, b) => a.timeSec - b.timeSec);
                
                console.log(`🔄 Auto-added LINEAR at ${linearTime.toFixed(2)}s (${TRANSITION_DURATION}s before STEP)`);
              }
            }
          }
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
