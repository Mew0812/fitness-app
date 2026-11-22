import {useEffect, useLayoutEffect, useRef} from 'react'

const excluded='input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[draggable="true"],[role="slider"],[data-no-swipe],dialog'

export function useEdgeSwipeBack(enabled:boolean,back:()=>void) {
  const action=useRef(back)
  useLayoutEffect(()=>{action.current=back},[back])
  useEffect(()=>{
    if(!enabled)return
    let gesture:{id:number;x:number;y:number;started:number;horizontal:boolean;scrollY:number}|null=null
    const cancel=()=>{gesture=null}
    const start=(event:TouchEvent)=>{
      cancel()
      if(event.touches.length!==1 || document.querySelector('dialog[open]'))return
      const target=event.target instanceof Element ? event.target : (event.target as Node|null)?.parentElement
      if(!target || target.closest(excluded))return
      const touch=event.touches[0]
      if(touch.clientX<0 || touch.clientX>32)return
      gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,started:Date.now(),horizontal:false,scrollY:window.scrollY}
    }
    const finish=(x:number,y:number)=>{
      const current=gesture
      if(!current || !current.horizontal || document.querySelector('dialog[open]'))return
      const dx=x-current.x,dy=Math.abs(y-current.y)
      if(Date.now()-current.started>2500 || Math.abs(window.scrollY-current.scrollY)>12){cancel();return}
      if(dx>=80 && dy<=50 && dx>dy*1.8){
        cancel() // Invoke once even if touchend follows or the UI rerenders.
        action.current()
      }
    }
    const move=(event:TouchEvent)=>{
      if(!gesture)return
      if(event.touches.length!==1 || Math.abs(window.scrollY-gesture.scrollY)>12){cancel();return}
      const touch=event.touches[0]
      if(touch.identifier!==gesture.id){cancel();return}
      const dx=touch.clientX-gesture.x,dy=Math.abs(touch.clientY-gesture.y)
      if(dy>50 || dx < -8 || (!gesture.horizontal && dy>16 && dy>=dx/1.8)){cancel();return}
      if(dx>10 && dx>dy*1.8)gesture.horizontal=true
      if(gesture.horizontal && event.cancelable)event.preventDefault()
      // iOS may cancel/end the native gesture without delivering a final touchend.
      finish(touch.clientX,touch.clientY)
    }
    const end=(event:TouchEvent)=>{
      if(!gesture)return
      if(event.touches.length){cancel();return}
      const touch=Array.from(event.changedTouches).find(t=>t.identifier===gesture?.id)
      if(touch)finish(touch.clientX,touch.clientY)
      cancel()
    }
    // Capture listeners cannot be hidden by a child's stopPropagation handler.
    document.addEventListener('touchstart',start,{capture:true,passive:true})
    document.addEventListener('touchmove',move,{capture:true,passive:false})
    document.addEventListener('touchend',end,{capture:true,passive:true})
    document.addEventListener('touchcancel',cancel,{capture:true,passive:true})
    return()=>{
      document.removeEventListener('touchstart',start,true)
      document.removeEventListener('touchmove',move,true)
      document.removeEventListener('touchend',end,true)
      document.removeEventListener('touchcancel',cancel,true)
    }
  },[enabled])
}
