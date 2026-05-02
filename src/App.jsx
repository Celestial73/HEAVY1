import AboutSection from './components/AboutSection'
import BeforeAfterSection from './components/BeforeAfterSection'
import FaqSection from './components/FaqSection'
import ProcessSection from './components/ProcessSection'
import TechnologySection from './components/TechnologySection'
import VolumetricLightingSection from './components/VolumetricLightingSection'

function App() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <VolumetricLightingSection />
      <main className="pb-12">
        <AboutSection />
        <BeforeAfterSection />
        <ProcessSection />
        <TechnologySection />
        <FaqSection />
      </main>
    </div>
  )
}

export default App
