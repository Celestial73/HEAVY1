import { toCssLength } from '../utils/cssLength.js'

/**
 * Блок «описание»: заголовок (название модели) + текст под ним.
 */
export default function PortfolioDescription({
  title,
  description,
  titleClassName = 'font-st-rome text-2xl leading-tight text-white sm:text-3xl',
  descriptionClassName = 'mt-3 whitespace-pre-line font-museo-cyrl text-base leading-relaxed text-white/85 sm:text-lg',
  width,
  titleFontSize,
  descriptionFontSize,
  className = '',
  style,
}) {
  if (!title && !description) return null

  const widthCss = toCssLength(width)
  const titleSizeCss = toCssLength(titleFontSize)
  const descriptionSizeCss = toCssLength(descriptionFontSize)

  return (
    <div
      className={className}
      style={{
        ...(widthCss ? { width: widthCss } : {}),
        ...style,
      }}
    >
      {title ? (
        <h3 className={titleClassName} style={titleSizeCss ? { fontSize: titleSizeCss } : undefined}>
          {title}
        </h3>
      ) : null}
      {description ? (
        <p
          className={descriptionClassName}
          style={descriptionSizeCss ? { fontSize: descriptionSizeCss } : undefined}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
