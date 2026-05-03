import { Route, Routes, useLocation } from 'react-router-dom'
import ComparisonSection from './components/ComparisonSection'
import ProcessSection from './components/ProcessSection'
import ScrollToTop from './components/ScrollToTop'
import VolumetricLightingSection from './components/VolumetricLightingSection'

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <ScrollToTop />
      <div key={location.pathname} className="animate-fade-page">
        <Routes location={location}>
          <Route path="/" element={<VolumetricLightingSection />} />
          <Route path="/comparison" element={<ComparisonSection />} />
          <Route path="/process" element={<ProcessSection />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
