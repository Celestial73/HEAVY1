import { useEffect, useState } from 'react'
import NextNavLink from './NextNavLink.jsx'
import PipelineDraggableCards from './PipelineDraggableCards.jsx'
import SectionTextOverlay from './SectionTextOverlay.jsx'
import { PIPELINE_SECTION_SETTINGS as defaults } from '../config/pipelineSectionSettings.js'

/**
 * Секция «Pipeline»: тексты настраиваются в `pipelineSectionSettings.js`
 * (`textOverlays`, `fadeTransitions`, `textOverlayItemDefaults`).
 */
export default function PipelineSection() {
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/pipelineSectionSettings.js', (mod) => {
      if (mod?.PIPELINE_SECTION_SETTINGS) setSettings(mod.PIPELINE_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  const {
    fadeTransitions,
    layoutColumnMaxWidth,
    textOverlayItemDefaults,
    textOverlays,
    pipelineCards,
    pipelineCardsStageInsetPx,
    pipelineCardsBottomReservePx,
    pipelineCardHeightWidthRatio,
  } = settings

  return (
    <section id="pipeline" className="relative min-h-svh w-full bg-black">
      <PipelineDraggableCards
        cards={pipelineCards}
        stageInsetPx={pipelineCardsStageInsetPx}
        bottomReservePx={pipelineCardsBottomReservePx}
        cardHeightWidthRatio={pipelineCardHeightWidthRatio}
      />
      <SectionTextOverlay
        items={textOverlays}
        itemDefaults={textOverlayItemDefaults}
        sceneReady
        fadeTransitions={fadeTransitions}
        layoutColumnMaxWidth={layoutColumnMaxWidth}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-55 flex justify-end px-6 pb-6 sm:px-10 sm:pb-8 lg:px-16 lg:pb-12">
        <NextNavLink
          to="/team-and-cta"
          ariaLabel="Перейти к странице команды"
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium uppercase tracking-[0.25em] text-white backdrop-blur-md transition hover:bg-white/10 active:scale-95"
        >
          О команде
        </NextNavLink>
      </div>
    </section>
  )
}
