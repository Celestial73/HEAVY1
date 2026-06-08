import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { preloadAppFonts } from './utils/fontLoader.js'
import ComparisonSection from './components/ComparisonSection'
import PortfolioSection from './components/PortfolioSection'
import OrderSection from './components/OrderSection.jsx'
import ScrollToTop from './components/ScrollToTop'
import VolumetricLightingSection from './components/VolumetricLightingSection'
import GlobalCtaButton from './components/GlobalCtaButton.jsx'
import VisitLogger from './components/VisitLogger.jsx'

function App() {
  const location = useLocation()

  useEffect(() => {
    preloadAppFonts()
  }, [])

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <VisitLogger />
      <ScrollToTop />
      <GlobalCtaButton />
      <div key={location.pathname} className="animate-fade-page">
        <Routes location={location}>
          <Route path="/" element={<VolumetricLightingSection />} />
          <Route path="/comparison" element={<ComparisonSection />} />
          <Route path="/portfolio" element={<PortfolioSection />} />
          <Route path="/order" element={<OrderSection />} />
          <Route path="/pipeline" element={<Navigate to="/portfolio" replace />} />
          <Route path="/process" element={<Navigate to="/portfolio" replace />} />
          <Route path="/team-and-cta" element={<Navigate to="/portfolio" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
