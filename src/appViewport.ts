import {useLayoutEffect} from 'react'

export function appScrollPosition() {
  return (document.querySelector<HTMLElement>('.app')?.scrollTop ?? 0) + window.scrollY
}

export function scrollAppToTop(behavior: ScrollBehavior = 'auto') {
  const app = document.querySelector<HTMLElement>('.app')
  if (app?.scrollTo) app.scrollTo({top:0,behavior})
  else window.scrollTo({top:0,behavior})
}

// iOS keyboards resize the visual viewport, not necessarily the CSS layout viewport.
// Keep native focusing/selection intact and leave pinch zoom to the browser.
export function useAppViewport() {
  useLayoutEffect(()=>{
    const root=document.getElementById('root')
    if (!root) return
    const viewport=window.visualViewport
    let frame=0
    const update=()=>{
      frame=0
      if (viewport && Math.abs(viewport.scale-1)>0.01) return
      const height=viewport?.height ?? window.innerHeight
      if (!Number.isFinite(height) || height<=0) return
      root.style.setProperty('--app-viewport-height',`${height}px`)
      root.style.setProperty('--app-viewport-top',`${Math.max(0,viewport?.offsetTop ?? 0)}px`)
    }
    const schedule=()=>{
      if (!frame) frame=requestAnimationFrame(update)
    }
    update()
    window.addEventListener('resize',schedule)
    viewport?.addEventListener('resize',schedule)
    viewport?.addEventListener('scroll',schedule)
    return()=>{
      window.removeEventListener('resize',schedule)
      viewport?.removeEventListener('resize',schedule)
      viewport?.removeEventListener('scroll',schedule)
      if (frame) cancelAnimationFrame(frame)
      root.style.removeProperty('--app-viewport-height')
      root.style.removeProperty('--app-viewport-top')
    }
  },[])
}
