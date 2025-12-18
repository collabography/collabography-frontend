# Collabography Frontend

**Asynchronous Dance Collaboration & Choreography Design Tool**

여러 댄서가 서로 다른 시간과 장소에서 촬영한 춤 영상을 기반으로, 하나의 군무를 설계·시뮬레이션할 수 있는 협업 도구입니다.

## 🚀 Quick Start

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 빌드
npm run build
```

## 🛠 Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **3D Rendering**: Three.js + React Three Fiber
- **State Management**: Zustand + Immer
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Audio**: Howler.js
- **Drag & Drop**: @dnd-kit

## 📁 Project Structure

```
src/
├── components/
│   ├── timeline/          # 타임라인 관련 컴포넌트
│   ├── visualization/     # Top/Front View 렌더링
│   └── ui/                # 공통 UI 컴포넌트
├── hooks/                 # 커스텀 훅
├── stores/                # Zustand 스토어
├── types/                 # TypeScript 타입 정의
├── lib/                   # 유틸리티 함수
└── pages/                 # 페이지 컴포넌트
    ├── ProjectListPage    # 프로젝트 목록
    ├── MusicSelectPage    # 음악 선택/업로드
    └── EditorPage         # 메인 에디터
```

## 🎯 Core Concepts

- **Project**: 하나의 군무 단위 (1개 음악 + 최대 3명 댄서)
- **Track**: 한 명의 댄서의 movement
- **Segment**: 특정 시간 구간의 춤 영상 (스켈레톤 데이터)
- **Skeleton**: MediaPipe Pose 기반 33개 관절 포인트

## 🎨 Color Palette

| 용도 | 색상 |
|------|------|
| Dancer 1 | `#f472b6` (Pink) |
| Dancer 2 | `#34d399` (Emerald) |
| Dancer 3 | `#fbbf24` (Amber) |
| Accent | `#6366f1` (Indigo) |

## 📝 MVP Features

- [x] 프로젝트 생성/목록 조회
- [x] 음악 업로드 및 타임라인 설정
- [ ] 영상 업로드 → 스켈레톤 자동 추출
- [ ] Top View (위에서 본 댄서 배치)
- [ ] Front View (스켈레톤 렌더링)
- [ ] 타임라인 세그먼트 관리
- [ ] 재생/일시정지 동기화

## 📄 License

MIT
