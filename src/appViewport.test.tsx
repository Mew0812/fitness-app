// @vitest-environment jsdom
import {act,cleanup,renderHook} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {appScrollPosition,scrollAppToTop,useAppViewport} from './appViewport'

afterEach(()=>{cleanup();document.getElementById('root')?.remove();document.querySelector('.app')?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()})
it('表示領域の高さ・オフセットを反映し、キーボード相当の縮小と閉じた後の復帰に対応する',()=>{
  vi.useFakeTimers()
  const root=document.createElement('div');root.id='root';document.body.append(root)
  const viewport=Object.assign(new EventTarget(),{height:844,offsetTop:0,scale:1})
  vi.stubGlobal('visualViewport',viewport)
  const view=renderHook(()=>useAppViewport())
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe('844px')
  viewport.height=420;viewport.offsetTop=100
  act(()=>{viewport.dispatchEvent(new Event('resize'));vi.advanceTimersByTime(20)})
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe('420px')
  expect(root.style.getPropertyValue('--app-viewport-top')).toBe('100px')
  viewport.scale=2;viewport.height=210
  act(()=>{viewport.dispatchEvent(new Event('resize'));vi.advanceTimersByTime(20)})
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe('420px')
  viewport.scale=1;viewport.height=844;viewport.offsetTop=0
  act(()=>{viewport.dispatchEvent(new Event('resize'));vi.advanceTimersByTime(20)})
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe('844px')
  expect(root.style.getPropertyValue('--app-viewport-top')).toBe('0px')
  view.unmount()
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe('')
})
it('visualViewportがなくても画面の高さを使用し、文書ではなくアプリをスクロールする',()=>{
  const root=document.createElement('div');root.id='root';document.body.append(root)
  vi.stubGlobal('visualViewport',undefined)
  renderHook(()=>useAppViewport())
  expect(root.style.getPropertyValue('--app-viewport-height')).toBe(`${window.innerHeight}px`)
  const app=document.createElement('div');app.className='app';app.scrollTop=160
  const scroll=vi.fn();app.scrollTo=scroll;document.body.append(app)
  expect(appScrollPosition()).toBe(160)
  scrollAppToTop('smooth')
  expect(scroll).toHaveBeenCalledWith({top:0,behavior:'smooth'})
})
