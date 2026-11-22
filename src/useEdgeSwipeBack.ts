import {useEffect} from 'react'

const excluded = 'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[draggable="true"],[role="slider"],[data-no-swipe],dialog'

// Single-finger edge gesture only. Keep touchstart passive for native vertical scrolling.
export function useEdgeSwipeBack(enabled: boolean, back: () => void) {
  useEffect(()=>{
    if (!enabled) return
    let gesture: {id:number; x:number; y:number; started:number; horizontal:boolean; scrollY:number} | null = null
    const start = (event: TouchEvent) => {
      gesture = null
      if (event.touches.length !== 1 || document.querySelector('dialog[open]')) return
      const target = event.target
      if (!(target instanceof Element) || target.closest(excluded)) return
      const touch = event.touches[0]
      if (touch.clientX < 0 || touch.clientX > 24) return
      gesture = {id:touch.identifier,x:touch.clientX,y:touch.clientY,started:Date.now(),horizontal:false,scrollY:window.scrollY}
    }
    const cancel = () => { gesture = null }
    const move = (event: TouchEvent) => {
      if (!gesture) return
      if (event.touches.length !== 1 || Math.abs(window.scrollY-gesture.scrollY)>8) { cancel(); return }
      const touch = event.touches[0]
      if (touch.identifier !== gesture.id) { cancel(); return }
      const dx=touch.clientX-gesture.x,dy=Math.abs(touch.clientY-gesture.y)
      if (dy>40 || dx < -8 || (!gesture.horizontal && dy>12 && dy>=dx/2)) { cancel(); return }
      if (dx>12 && dx>dy*2) gesture.horizontal=true
      if (gesture.horizontal && event.cancelable) event.preventDefault()
    }
    const end = (event: TouchEvent) => {
      const current=gesture
      cancel()
      if (!current?.horizontal || event.touches.length || document.querySelector('dialog[open]')) return
      const touch=Array.from(event.changedTouches).find(t=>t.identifier===current.id)
      if (!touch || Date.now()-current.started>1000 || Math.abs(window.scrollY-current.scrollY)>8) return
      const dx=touch.clientX-current.x,dy=Math.abs(touch.clientY-current.y)
      if (dx>=80 && dy<=40 && dx>dy*2) back()
    }
    document.addEventListener('touchstart',start,{passive:true})
    document.addEventListener('touchmove',move,{passive:false})
    document.addEventListener('touchend',end,{passive:true})
    document.addEventListener('touchcancel',cancel,{passive:true})
    return ()=>{
      document.removeEventListener('touchstart',start)
      document.removeEventListener('touchmove',move)
      document.removeEventListener('touchend',end)
      document.removeEventListener('touchcancel',cancel)
    }
  },[enabled,back])
}
