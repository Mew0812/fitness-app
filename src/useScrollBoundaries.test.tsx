// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {useScrollBoundaries} from './useScrollBoundaries'

function Harness(){
  useScrollBoundaries()
  return <div className="app" data-testid="app" style={{overflowY:'auto'}}>
    <div data-testid="content">内容</div><input aria-label="入力"/><textarea aria-label="設定"/><select aria-label="選択"><option>1</option></select>
    <div data-testid="nested" style={{overflowY:'auto'}}>独立した領域</div>
  </div>
}
const finger=(x:number,y:number)=>({identifier:1,clientX:x,clientY:y})
function drag(target:Element,dy:number,dx=0){
  fireEvent.touchStart(target,{touches:[finger(160,200)]})
  return fireEvent.touchMove(target,{touches:[finger(160+dx,200+dy)],cancelable:true})
}
function metrics(el:HTMLElement,height:number,client=500){
  Object.defineProperty(el,'scrollHeight',{configurable:true,value:height})
  Object.defineProperty(el,'clientHeight',{configurable:true,value:client})
}
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('上端の下向き・下端の上向きだけを抑止し、中央の縦スクロールと横操作は維持する',()=>{
  render(<Harness/>)
  const app=screen.getByTestId('app'),target=screen.getByTestId('content')
  metrics(app,1000)
  app.scrollTop=0
  expect(drag(target,80)).toBe(false)
  expect(drag(target,-80)).toBe(true)
  app.scrollTop=200
  expect(drag(target,80)).toBe(true)
  expect(drag(target,-80)).toBe(true)
  app.scrollTop=500
  expect(drag(target,-80)).toBe(false)
  expect(drag(target,80)).toBe(true)
  expect(drag(target,4,100)).toBe(true)
})
it('短い画面の引っ張りを抑え、入力・textarea・selectの操作やピンチは奪わない',()=>{
  render(<Harness/>)
  metrics(screen.getByTestId('app'),500)
  const target=screen.getByTestId('content')
  expect(drag(target,80)).toBe(false)
  expect(drag(target,-80)).toBe(false)
  for(const label of ['入力','設定','選択'])expect(drag(screen.getByLabelText(label),80)).toBe(true)
  fireEvent.touchStart(target,{touches:[finger(100,200),{...finger(150,200),identifier:2}]})
  expect(fireEvent.touchMove(target,{touches:[finger(100,280)],cancelable:true})).toBe(true)
})
it('内側の領域にスクロール余地がある場合は許可し、どこにも余地がない場合だけ抑止する',()=>{
  const view=render(<Harness/>)
  const app=screen.getByTestId('app'),nested=screen.getByTestId('nested')
  metrics(app,500);metrics(nested,1000,200)
  nested.scrollTop=100
  expect(drag(nested,80)).toBe(true)
  nested.scrollTop=0
  expect(drag(nested,80)).toBe(false)
  expect(drag(nested,-80)).toBe(true)
  metrics(app,1000);app.scrollTop=100
  expect(drag(nested,80)).toBe(true)
  view.unmount()
  expect(drag(document.body,80)).toBe(true)
})
