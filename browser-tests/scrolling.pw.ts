import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
import {seed,swipe,readRecords,touch} from './helpers'

async function checkBounds(page:Page) {
  const app=page.locator('.app')
  await app.evaluate(el=>el.scrollTop=-500)
  await expect.poll(()=>app.evaluate(el=>el.scrollTop)).toBe(0)
  await app.evaluate(el=>el.scrollTop=1e7)
  await expect.poll(()=>app.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThanOrEqual(1)
  const position=await app.boundingBox()
  expect(position!.y).toBe(0)
  expect(await page.evaluate(()=>scrollY)).toBe(0)
  const overscroll=await app.evaluate(el=>({supported:CSS.supports('overscroll-behavior-y','none'),value:getComputedStyle(el).getPropertyValue('overscroll-behavior-y')}))
  if(overscroll.supported)expect(overscroll.value).toBe('none')
  // If the engine lacks the CSS feature, the boundary-only touch fallback must still work.
  expect(await touch(page,[{x:180,y:240},{x:181,y:180},{x:181,y:180}],'.app')).toBe(false)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
}

test('短い店舗・種目・設定画面に不要な縦スクロールを作らず、設定を閉じてもデータを保持する',async({page})=>{
  await page.goto('./')
  await expect(page.getByRole('button',{name:'A店',exact:true})).toBeEnabled()
  for(let step=0;step<3;step++){
    const app=page.locator('.app')
    expect(await app.evaluate(el=>el.scrollHeight-el.clientHeight)).toBe(0)
    await checkBounds(page)
    if(step===0)await page.getByRole('button',{name:'A店',exact:true}).tap()
    if(step===1)await page.getByLabel('店舗を選択').selectOption('__settings__')
  }
})

test('長い記録・設定画面は上下端で止まり、最下部の入力・復元ボタンに到達できる',async({page})=>{
  await seed(page)
  await page.getByRole('button',{name:'アシストディップ'}).tap()
  await page.getByLabel('重量 (kg)').fill('40')
  await page.getByLabel('回数',{exact:true}).fill('10')
  await page.getByRole('button',{name:'セット数を増やす'}).tap()
  await page.getByRole('button',{name:'＋ 記録を保存'}).tap()
  await expect.poll(()=>readRecords(page)).toHaveLength(1)
  await checkBounds(page)
  await page.locator('footer').scrollIntoViewIfNeeded()
  await expect(page.locator('footer')).toBeInViewport()
  await page.locator('.app').evaluate(el=>el.scrollTop=0)
  await swipe(page)
  await expect(page.getByLabel('種目一覧')).toBeVisible()
  await page.getByLabel('店舗を選択').selectOption('__settings__')
  await page.getByRole('button',{name:'バックアップ・復元',exact:true}).tap()
  await checkBounds(page)
  await page.getByLabel('復元するJSONファイル').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('復元するJSONファイル')).toBeInViewport()
  await page.locator('.app').evaluate(el=>el.scrollTop=0)
  await swipe(page)
  await expect(page.getByRole('navigation',{name:'設定メニュー'})).toBeVisible()
  expect(await readRecords(page)).toHaveLength(1)
})

test('画面高さの縮小・復帰と入力フォーカス、textareaの独立スクロールを維持する',async({page})=>{
  await seed(page)
  await page.getByLabel('店舗を選択').selectOption('__settings__')
  await page.getByRole('button',{name:'種目の管理',exact:true}).tap()
  const text=page.getByRole('textbox',{name:'設定',exact:true})
  await text.fill(Array.from({length:40},(_,i)=>`設定 ${i}`).join('\n'))
  await expect(text).toBeFocused()
  await page.setViewportSize({width:390,height:400})
  await expect.poll(()=>page.locator('.app').evaluate(el=>el.clientHeight)).toBe(400)
  await text.scrollIntoViewIfNeeded()
  await expect(text).toBeFocused()
  await expect(text).toBeInViewport()
  const before=await page.locator('.app').evaluate(el=>el.scrollTop)
  await text.evaluate(el=>el.scrollTop=el.scrollHeight)
  expect(await text.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
  expect(await page.locator('.app').evaluate(el=>el.scrollTop)).toBe(before)
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.locator('.app').evaluate(el=>el.clientHeight)).toBe(844)
  await page.getByRole('button',{name:'＋ 種目を登録'}).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button',{name:'＋ 種目を登録'})).toBeInViewport()
  expect(await readRecords(page)).toEqual([])
})

test('長い種目一覧の末尾と日付一覧の独立した横スクロールを維持する',async({page})=>{
  await seed(page)
  await page.evaluate(async()=>{
    const request=indexedDB.open('myfitness',1)
    const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result)})
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),get=store.get('main')
      get.onsuccess=()=>{
        const data=get.result
        for(let i=0;i<30;i++){
          data.exercises.push({id:`long-${i}`,name:`追加種目 ${String(i).padStart(2,'0')}`,recordingMode:'strength'})
          data.storeExercises.push({storeId:'a',exerciseId:`long-${i}`})
          const day=new Date(2026,10,22-i),date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
          data.workouts.push({id:`record-${i}`,exerciseId:'bench',date,weight:40,reps:10,sets:3})
        }
        store.put(data,'main')
      }
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)
    })
    db.close()
  })
  await page.reload()
  await page.getByRole('button',{name:'A店',exact:true}).tap()
  await checkBounds(page)
  const last=page.getByLabel('種目一覧').getByRole('button').last()
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await page.getByLabel('店舗を選択').selectOption('__settings__')
  await page.getByRole('button',{name:'履歴',exact:true}).tap()
  const strip=page.locator('.date-list')
  const top=await page.locator('.app').evaluate(el=>el.scrollTop)
  await strip.evaluate(el=>el.scrollLeft=el.scrollWidth)
  expect(await strip.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0)
  expect(await page.locator('.app').evaluate(el=>el.scrollTop)).toBe(top)
  expect(await touch(page,[{x:5,y:150},{x:120,y:152},{x:120,y:152}],'.date-list')).toBe(true)
  await expect(page.getByRole('heading',{name:'日付別の履歴'})).toBeVisible()
  expect(await readRecords(page)).toHaveLength(30)
})

test.describe('狭いWebKitでのネイティブwheelスクロール',()=>{
  // Desktop WebKit provides wheel input; mobile WebKit's OS edge/elastic gestures are not emulated.
  test.use({isMobile:false})
  test('上端・下端へ繰り返しスクロールしても外側の文書が移動しない',async({page})=>{
    await seed(page)
    await page.getByRole('button',{name:'アシストディップ'}).click()
    await page.getByLabel('重量 (kg)').fill('40')
    await page.getByLabel('回数',{exact:true}).fill('10')
    await page.getByRole('button',{name:'セット数を増やす'}).click()
    await page.getByRole('button',{name:'＋ 記録を保存'}).click()
    await expect.poll(()=>readRecords(page)).toHaveLength(1)
    await page.mouse.move(180,300)
    await page.mouse.wheel(0,10000)
    await expect.poll(()=>page.locator('.app').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThanOrEqual(1)
    await page.mouse.wheel(0,10000)
    await checkBounds(page)
    await page.mouse.wheel(0,-10000)
    await expect.poll(()=>page.locator('.app').evaluate(el=>el.scrollTop)).toBe(0)
    await page.mouse.wheel(0,-10000)
    expect(await page.evaluate(()=>scrollY)).toBe(0)
    // At the very top an outward pull is stopped, while the record screen remains active.
    expect(await touch(page,[{x:5,y:120},{x:7,y:170},{x:8,y:220},{x:8,y:220}])).toBe(false)
    await expect(page.getByLabel('重量 (kg)')).toBeVisible()
  })
})
