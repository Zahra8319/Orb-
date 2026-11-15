import { useEffect, useRef, useState } from 'react'

interface MobileHeroProps {
  /** Image paths relative to /public/hero/mobile/ or full URLs */
  images: string[]
  /** Auto-advance interval in ms */
  interval?: number
  /** Pause on hover/focus */
  pauseOnHover?: boolean
  /** CSS class for the container */
  className?: string
}

export function MobileHeroSlideshow({
  images,
  interval = 6000,
  pauseOnHover = true,
  className = '',
}: MobileHeroProps) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef<number | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Preload all images
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [images])

  // Auto-advance
  useEffect(() => {
    if (!pauseOnHover) return
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, interval)
    return () => window.clearInterval(timerRef.current)
  }, [images.length, interval, pauseOnHover])

  // Pause on hover/focus
  useEffect(() => {
    if (!pauseOnHover) return
    const el = containerRef.current
    if (!el) return
    const pause = () => window.clearInterval(timerRef.current)
    const resume = () => {
      timerRef.current = window.setInterval(() => {
        setIndex((i) => (i + 1) % images.length)
      }, interval)
    }
    el.addEventListener('mouseenter', pause)
    el.addEventListener('focusin', pause)
    el.addEventListener('mouseleave', resume)
    el.addEventListener('focusout', resume)
    return () => {
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('mouseleave', resume)
      el.removeEventListener('focusout', resume)
    }
  }, [interval, pauseOnHover])

  return (
    <div
      ref={containerRef}
      className={`mobile-hero-slideshow ${className}`}
      role="region"
      aria-label="Mission imagery"
      aria-roledescription="slideshow"
    >
      {images.map((src, i) => (
        <div
          key={src}
          className={`mobile-hero-slide ${i === index ? 'active' : ''}`}
          style={{
            opacity: i === index ? 1 : 0,
            transform: i === index ? 'scale(1)' : 'scale(1.02)',
            transition: 'opacity 1.2s ease-out, transform 1.2s ease-out',
            willChange: 'opacity, transform',
          }}
          aria-hidden={i !== index}
          aria-current={i === index ? 'true' : 'false'}
        >
          <img
            src={src}
            alt={i === 0 ? 'Astronaut on Mars surface' : ''}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Subtle gradient overlay for text readability */}
          <div className="mobile-hero-overlay" aria-hidden="true" />
        </div>
      ))}

      {/* Dots indicator */}
      {images.length > 1 && (
        <nav className="mobile-hero-dots" aria-label="Slide navigation">
          {images.map((_, i) => (
            <button
              key={i}
              className={`mobile-hero-dot ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index ? 'true' : 'false'}
            />
          ))}
        </nav>
      )}
    </div>
  )
}