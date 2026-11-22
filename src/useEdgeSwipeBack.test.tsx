// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {useEdgeSwipeBack} from './useEdgeSwipeBack'

function Harness({back,enabled=true}:{back:()=>void;enabled?:boolean}) {
  useEdgeSwipeBack(enabled,back)
  return <main data-testid="edge"><input aria-label="入力"/><select aria-label="選択"><option>1</option></select>
    <button>操作</button><div draggable>ドラッグ</div><div contentEditable suppressContentEditableWarning>編集領域</div>
    <div data-no-swipe>独自操作</div></main>
}
const touch=(x:number,y:number,id=1)=>({identifier:id,clientX:x,clientY:y})
function start(target:Element,x=5,y=100) {fireEvent.touchStart(target,{touches:[touch(x,y)]})}
function move(target:Element,x=110,y=105) {return fireEvent.touchMove(target,{touches:[touch(x,y)],cancelable:true})}
function end(target:Element,x=110,y=105) {fireEvent.touchEnd(target,{touches:[],changedTouches:[touch(x,y)]})}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
it('iPhone幅375pxで左端32px以内・80px以上の右スワイプだけを1回戻ると判定する',()=>{
  vi.spyOn(window,'innerWidth','get').mockReturnValue(375)
  const back=vi.fn();render(<Harness back={back}/>)
  const target=screen.getByTestId('edge')
  start(target);expect(move(target)).toBe(false);end(target);end(target)
  expect(back).toHaveBeenCalledTimes(1)
})
it.each([[33,100,200,105],[5,100,60,105],[5,100,100,160],[5,100,0,100]])('端以外・短距離・縦方向・逆方向の操作では戻らない (%s,%s→%s,%s)',(x,y,toX,toY)=>{
  const back=vi.fn();render(<Harness back={back}/>)
  const target=screen.getByTestId('edge')
  start(target,x,y);move(target,toX,toY);end(target,toX,toY)
  expect(back).not.toHaveBeenCalled()
})
it('縦スクロール・斜めスクロールのtouchmoveをキャンセルせず、途中で横に動いても戻らない',()=>{
  const back=vi.fn();render(<Harness back={back}/>)
  const target=screen.getByTestId('edge')
  start(target)
  expect(move(target,8,140)).toBe(true)
  expect(move(target,150,145)).toBe(true)
  end(target,150,145)
  expect(back).not.toHaveBeenCalled()
})
it.each(['入力','選択','操作','ドラッグ','編集領域','独自操作'])('%sからの操作は横ドラッグを妨げず、戻らない',name=>{
  const back=vi.fn();render(<Harness back={back}/>)
  const target=screen.queryByLabelText(name)??screen.getByText(name)
  start(target);expect(move(target)).toBe(true);end(target)
  expect(back).not.toHaveBeenCalled()
})
it('複数指・touchcancel・長いドラッグ・実際にページがスクロールした場合は戻らない',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000)
  const back=vi.fn();render(<Harness back={back}/>)
  const target=screen.getByTestId('edge')
  start(target)
  fireEvent.touchMove(target,{touches:[touch(100,100),touch(120,100,2)]})
  end(target)
  start(target);move(target,30);fireEvent.touchCancel(target);end(target)
  start(target);vi.advanceTimersByTime(2501);move(target);end(target)
  start(target);vi.spyOn(window,'scrollY','get').mockReturnValue(50);move(target);end(target)
  expect(back).not.toHaveBeenCalled()
})
it('途中の再描画や1秒を超える操作でも、touchendなしで規定距離に達したら最新の戻る処理を1回実行する',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000)
  const first=vi.fn(),second=vi.fn(),view=render(<Harness back={first}/>)
  const target=screen.getByTestId('edge')
  start(target);move(target,25)
  view.rerender(<Harness back={second}/>)
  vi.advanceTimersByTime(1500)
  move(target,110)
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  end(target)
  expect(second).toHaveBeenCalledTimes(1)
})
it('画像拡大ダイアログや保存中の画面では戻らず、解除後は再び操作できる',()=>{
  const back=vi.fn(),view=render(<Harness back={back} enabled={false}/>)
  let target=screen.getByTestId('edge')
  start(target);move(target);end(target)
  expect(back).not.toHaveBeenCalled()
  view.rerender(<Harness back={back}/>)
  target=screen.getByTestId('edge')
  const dialog=document.createElement('dialog');dialog.open=true;document.body.append(dialog)
  start(target);move(target);end(target)
  expect(back).not.toHaveBeenCalled()
  dialog.remove()
  start(target);move(target);end(target)
  expect(back).toHaveBeenCalledTimes(1)
  view.unmount()
  start(document.body);move(document.body);end(document.body)
  expect(back).toHaveBeenCalledTimes(1)
})
