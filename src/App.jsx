import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ComparisonSection from './components/ComparisonSection'
import ProcessSection from './components/ProcessSection'
import TeamAndCTASection from './components/TeamAndCTASection'
import ScrollToTop from './components/ScrollToTop'
import VolumetricLightingSection from './components/VolumetricLightingSection'
import { loadWorkflowSectionModule } from './utils/workflowSectionChunk'

const WorkflowSection = lazy(loadWorkflowSectionModule)

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <ScrollToTop />
      <div key={location.pathname} className="animate-fade-page">
        <Routes location={location}>
          <Route path="/" element={<VolumetricLightingSection />} />
          <Route
            path="/workflow"
            element={
              <Suspense
                fallback={<div className="min-h-screen bg-black" aria-hidden="true" />}
              >
                <WorkflowSection />
              </Suspense>
            }
          />
          <Route path="/comparison" element={<ComparisonSection />} />
          <Route path="/team-and-cta" element={<TeamAndCTASection />} />
          <Route path="/process" element={<ProcessSection />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
