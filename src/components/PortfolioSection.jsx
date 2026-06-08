import { useEffect, useState } from 'react'
import { PORTFOLIO_SECTION_SETTINGS as defaults } from '../config/portfolioSectionSettings.js'
import { toCssLength } from '../utils/cssLength.js'
import {
  getPortfolioBlockPresentation,
} from '../utils/portfolioBlockSize.js'
import { computePortfolioStageHeightVh, getPortfolioBlockPositionPresentation } from '../utils/portfolioPosition.js'
import PortfolioDescription from './PortfolioDescription.jsx'

function resolvePublicAssetUrl(url) {
  if (!url) return url
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${normalizedBase}${normalizedUrl}`
}

function PortfolioImageBlock({ block, frameClassName, animationDelaySec }) {
  const src = block.imageUrl ? resolvePublicAssetUrl(block.imageUrl) : null
  if (!src) return null

  const maxHeightCss = toCssLength(block.maxHeight)
  const fit =
    block.objectFit === 'cover' || block.objectFit === 'contain' || block.objectFit === 'fill'
      ? block.objectFit
      : 'contain'

  const useAspect = typeof block.aspectRatio === 'string' && block.aspectRatio.trim().length > 0
  const frameStyle = useAspect
    ? {
        aspectRatio: block.aspectRatio.trim(),
        width: '100%',
        maxHeight: maxHeightCss,
      }
    : {
        width: '100%',
        height: toCssLength(block.height) ?? toCssLength(block.heightVh, 'vh') ?? '36vh',
        maxHeight: maxHeightCss,
      }

  const delayS =
    typeof animationDelaySec === 'number' && Number.isFinite(animationDelaySec)
      ? animationDelaySec
      : 0

  const flipX = block.flipHorizontal === true || block.scaleX === -1
  const flipY = block.flipVertical === true || block.scaleY === -1
  const imageTransform =
    flipX || flipY
      ? `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
      : undefined

  return (
    <div className="animate-fade-up w-full" style={{ animationDelay: `${delayS}s` }}>
      <figure className="flex w-full max-w-full flex-col">
        <div className={frameClassName} style={frameStyle}>
          <img
            src={src}
            alt={block.imageAlt ?? ''}
            className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : fit === 'fill' ? 'object-fill' : 'object-contain'}`}
            style={imageTransform ? { transform: imageTransform } : undefined}
            loading="lazy"
            decoding="async"
          />
        </div>
        {block.caption ? (
          <figcaption className={block.captionClassName ?? 'mt-2 text-sm text-white/70'}>
            {block.caption}
          </figcaption>
        ) : null}
      </figure>
    </div>
  )
}

function PortfolioTextBlock({ block, animationDelaySec }) {
  if (!block.text) return null

  const delayS =
    typeof animationDelaySec === 'number' && Number.isFinite(animationDelaySec)
      ? animationDelaySec
      : 0

  return (
    <div
      className={`animate-fade-up w-full ${block.className ?? ''}`}
      style={{ animationDelay: `${delayS}s` }}
    >
      {block.text}
    </div>
  )
}

function resolveFallbackWidthVw(block, imageDefaults, descriptionDefaults, textDefaults) {
  if (block.type === 'image') {
    return imageDefaults?.widthVw ?? 40
  }
  if (block.type === 'description') {
    return descriptionDefaults?.widthVw ?? 38
  }
  if (block.type === 'text') {
    return textDefaults?.widthVw ?? 50
  }
  return 40
}

function PortfolioBlock({
  block,
  descriptionDefaults,
  imageDefaults,
  textDefaults,
  stageInsetPx,
  animationDelaySec,
}) {
  const { className: positionClassName, posStyle } = getPortfolioBlockPositionPresentation(block)
  const fallbackWidthVw = resolveFallbackWidthVw(
    block,
    imageDefaults,
    descriptionDefaults,
    textDefaults,
  )
  const { className: widthClassName, sizeStyle } = getPortfolioBlockPresentation(
    block,
    fallbackWidthVw,
    stageInsetPx,
  )

  let inner = null
  if (block.type === 'image') {
    inner = (
      <PortfolioImageBlock
        block={{ ...imageDefaults, ...block }}
        frameClassName={block.frameClassName ?? imageDefaults.frameClassName}
        animationDelaySec={animationDelaySec}
      />
    )
  } else if (block.type === 'description') {
    inner = (
      <div className="animate-fade-up w-full" style={{ animationDelay: `${animationDelaySec}s` }}>
        <PortfolioDescription
          title={block.title}
          description={block.description}
          titleClassName={block.titleClassName ?? descriptionDefaults.titleClassName}
          descriptionClassName={block.descriptionClassName ?? descriptionDefaults.descriptionClassName}
          titleFontSize={block.titleFontSize ?? descriptionDefaults.titleFontSize}
          descriptionFontSize={block.descriptionFontSize ?? descriptionDefaults.descriptionFontSize}
        />
      </div>
    )
  } else if (block.type === 'text') {
    inner = (
      <PortfolioTextBlock
        block={{ ...textDefaults, ...block }}
        animationDelaySec={animationDelaySec}
      />
    )
  }

  if (!inner) return null

  const blockClassName = [positionClassName, widthClassName].filter(Boolean).join(' ') || undefined

  return (
    <div className={blockClassName} style={{ ...posStyle, ...sizeStyle }}>
      {inner}
    </div>
  )
}

function PortfolioHero({ hero, intro, stageInsetPx }) {
  if (hero?.enabled === false || !hero?.title) return null

  const titleFontSize = toCssLength(hero.titleFontSize)
  const delayS =
    typeof intro?.hero?.delay === 'number' && Number.isFinite(intro.hero.delay)
      ? intro.hero.delay
      : 0.5

  const { className: positionClassName, posStyle } = getPortfolioBlockPositionPresentation(hero)
  const heroZIndex =
    hero?.zIndex != null && hero.zIndex !== '' && Number.isFinite(Number(hero.zIndex))
      ? Number(hero.zIndex)
      : undefined

  if (hero.sticky) {
    return (
      <header
        className="pointer-events-none sticky top-0 w-full"
        style={{
          paddingLeft: stageInsetPx,
          paddingRight: stageInsetPx,
          ...(heroZIndex != null ? { zIndex: heroZIndex } : {}),
        }}
      >
        <div className="animate-fade-up pt-6 sm:pt-8" style={{ animationDelay: `${delayS}s` }}>
          <h1
            className={hero.titleClassName}
            style={titleFontSize ? { fontSize: titleFontSize } : undefined}
          >
            {hero.title}
          </h1>
        </div>
      </header>
    )
  }

  return (
    <div style={posStyle} className={['pointer-events-none', positionClassName].filter(Boolean).join(' ')}>
      <div className="animate-fade-up" style={{ animationDelay: `${delayS}s` }}>
        <h1
          className={hero.titleClassName}
          style={titleFontSize ? { fontSize: titleFontSize } : undefined}
        >
          {hero.title}
        </h1>
      </div>
    </div>
  )
}

export default function PortfolioSection() {
  const [settings, setSettings] = useState(defaults)

  useEffect(() => {
    if (!import.meta.hot) return undefined
    import.meta.hot.accept('../config/portfolioSectionSettings.js', (mod) => {
      if (mod?.PORTFOLIO_SECTION_SETTINGS) setSettings(mod.PORTFOLIO_SECTION_SETTINGS)
    })
    return undefined
  }, [])

  const {
    layout,
    intro,
    hero,
    blocks,
    descriptionDefaults,
    imageDefaults,
    textDefaults,
  } = settings

  const blockList = Array.isArray(blocks) ? blocks : []
  const stageHeightVh = computePortfolioStageHeightVh(blockList, {
    minHeightVh: layout.minScrollHeightVh,
    bottomPaddingVh: layout.bottomPaddingVh,
    stageHeightVh: layout.stageHeightVh,
  })

  const blockIntro = intro?.blocks ?? { delay: 0.65, staggerSec: 0.12 }
  const blockBaseDelay =
    typeof blockIntro.delay === 'number' && Number.isFinite(blockIntro.delay)
      ? blockIntro.delay
      : 0.65
  const blockStagger =
    typeof blockIntro.staggerSec === 'number' && Number.isFinite(blockIntro.staggerSec)
      ? blockIntro.staggerSec
      : 0.12

  const stageInsetPx = layout.stageInsetPx ?? 24

  return (
    <section
      id={layout.sectionId}
      className={`${layout.sectionClassName} overflow-x-hidden`.trim()}
    >
      <div
        className={layout.stageClassName}
        style={{
          minHeight: `${stageHeightVh}vh`,
          paddingLeft: stageInsetPx,
          paddingRight: stageInsetPx,
          boxSizing: 'border-box',
        }}
      >
        <PortfolioHero hero={hero} intro={intro} stageInsetPx={stageInsetPx} />

        {blockList.map((block, i) => {
          const blockKey = block.id ?? `${block.type}-${i}`
          const ownDelay = block?.delay
          const animationDelaySec =
            typeof ownDelay === 'number' && Number.isFinite(ownDelay)
              ? ownDelay
              : blockBaseDelay + i * blockStagger

          return (
            <PortfolioBlock
              key={blockKey}
              block={block}
              descriptionDefaults={descriptionDefaults ?? {}}
              imageDefaults={imageDefaults ?? {}}
              textDefaults={textDefaults ?? {}}
              stageInsetPx={stageInsetPx}
              animationDelaySec={animationDelaySec}
            />
          )
        })}
      </div>
    </section>
  )
}
