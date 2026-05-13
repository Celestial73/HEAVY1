import { Route, Routes, useLocation } from 'react-router-dom'
import ComparisonSection from './components/ComparisonSection'
import PipelineSection from './components/PipelineSection'
import ProcessSection from './components/ProcessSection'
import TeamAndCTASection from './components/TeamAndCTASection'
import ScrollToTop from './components/ScrollToTop'
import VolumetricLightingSection from './components/VolumetricLightingSection'
import VisitLogger from './components/VisitLogger.jsx'

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <VisitLogger />
      <ScrollToTop />
      <div key={location.pathname} className="animate-fade-page">
        <Routes location={location}>
          <Route path="/" element={<VolumetricLightingSection />} />
          <Route path="/pipeline" element={<PipelineSection />} />
          <Route path="/comparison" element={<ComparisonSection />} />
          <Route path="/team-and-cta" element={<TeamAndCTASection />} />
          <Route path="/process" element={<ProcessSection />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
