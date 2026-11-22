import {expect} from '@playwright/test'
import type {Page} from '@playwright/test'

// Isolated browser contexts and origin; never reads/writes the user's iPhone data.
export async function seed(page:Page) {
  await page.goto('./')
  await expect(page.getByRole('button',{name:'A店',exact:true})).toBeEnabled()
  await page.evaluate(async()=>{
    const open=indexedDB.open('myfitness',1)
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error)})
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('data','readwrite')
      tx.objectStore('data').put({version:9,legacySettings:[],stores:[{id:'a',name:'A店'},{id:'b',name:'B店'},{id:'c',name:'C店'}],
        exercises:[{id:'bench',name:'アシストディップ',recordingMode:'strength',settings:'座面：4'},{id:'other',name:'別種目',recordingMode:'strength'}],
        storeExercises:[{storeId:'a',exerciseId:'bench'},{storeId:'b',exerciseId:'bench'},{storeId:'a',exerciseId:'other'}],workouts:[]},'main')
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)
    })
    db.close()
  })
  await page.reload()
  await page.getByRole('button',{name:'A店',exact:true}).click()
}
export async function readRecords(page:Page) {
  return page.evaluate(async()=>{
    const r=indexedDB.open('myfitness',1)
    const db=await new Promise<IDBDatabase>(resolve=>{r.onsuccess=()=>resolve(r.result)})
    const tx=db.transaction('data','readonly'),get=tx.objectStore('data').get('main')
    const value=await new Promise<{workouts:{id:string;sets:number;date:string;exerciseId:string}[]}>(resolve=>{get.onsuccess=()=>resolve(get.result)})
    db.close();return value.workouts
  })
}
export async function touch(page:Page,points:{x:number;y:number}[],selector?:string) {
  return page.evaluate(({points,selector})=>{
    const target=selector?document.querySelector(selector)!:document.elementFromPoint(points[0].x,points[0].y)!
    let uncancelled=true
    for(let i=0;i<points.length;i++){
      const p=points[i]
      const finger={identifier:7,target,clientX:p.x,clientY:p.y,pageX:p.x,pageY:p.y+scrollY}
      const type=i===0?'touchstart':i===points.length-1?'touchend':'touchmove'
      // Desktop WebKit forbids constructing Touch. Use explicitly synthetic DOM events.
      // This does NOT emulate the iPhone OS's native edge-navigation recognizer.
      const event=new Event(type,{bubbles:true,cancelable:true})
      Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[finger]},changedTouches:{value:[finger]}})
      if(!target.dispatchEvent(event))uncancelled=false
    }
    return uncancelled
  },{points,selector})
}
export async function swipe(page:Page) {await touch(page,[{x:6,y:120},{x:35,y:122},{x:150,y:126},{x:150,y:126}])}
