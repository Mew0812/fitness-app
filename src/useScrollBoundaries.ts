import {useEffect} from 'react'

const nativeControls='input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'

// Fallback for WebKit implementations which ignore/omit overscroll-behavior.
// Only prevent an outward vertical move if no nested scroll area can consume it.
export function useScrollBoundaries() {
  useEffect(()=>{
    let touch:{id:number;x:number;y:number;target:Element;app:HTMLElement}|null=null
    const start=(event:TouchEvent)=>{
      touch=null
      if(event.touches.length!==1 || !(event.target instanceof Element))return
      const target=event.target,app=target.closest<HTMLElement>('.app')
      if(!app || target.closest(nativeControls) || document.querySelector('dialog[open]'))return
      const finger=event.touches[0]
      touch={id:finger.identifier,x:finger.clientX,y:finger.clientY,target,app}
    }
    const cancel=()=>{touch=null}
    const move=(event:TouchEvent)=>{
      if(!touch)return
      if(event.touches.length!==1){cancel();return}
      const finger=event.touches[0]
      if(finger.identifier!==touch.id){cancel();return}
      const dx=finger.clientX-touch.x,dy=finger.clientY-touch.y
      if(Math.abs(dy)<6 || Math.abs(dy)<=Math.abs(dx)*1.2)return
      touch.x=finger.clientX;touch.y=finger.clientY
      for(let element:Element|null=touch.target;element;element=element.parentElement){
        if(element instanceof HTMLElement && /auto|scroll|overlay/.test(getComputedStyle(element).overflowY)){
          const max=element.scrollHeight-element.clientHeight
          if(max>1 && (dy>0 ? element.scrollTop>1 : element.scrollTop<max-1))return
        }
        if(element===touch.app)break
      }
      if(event.cancelable)event.preventDefault()
    }
    document.addEventListener('touchstart',start,{capture:true,passive:true})
    document.addEventListener('touchmove',move,{capture:true,passive:false})
    document.addEventListener('touchend',cancel,{capture:true,passive:true})
    document.addEventListener('touchcancel',cancel,{capture:true,passive:true})
    return()=>{
      document.removeEventListener('touchstart',start,true)
      document.removeEventListener('touchmove',move,true)
      document.removeEventListener('touchend',cancel,true)
      document.removeEventListener('touchcancel',cancel,true)
    }
  },[])
}
