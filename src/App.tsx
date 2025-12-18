import { Routes, Route } from 'react-router-dom'
import ProjectListPage from '@/pages/ProjectListPage'
import MusicSelectPage from '@/pages/MusicSelectPage'
import EditorPage from '@/pages/EditorPage'

function App() {
  return (
    <div className="min-h-full bg-surface-900">
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/project/new" element={<MusicSelectPage />} />
        <Route path="/project/:projectId" element={<EditorPage />} />
      </Routes>
    </div>
  )
}

export default App

