import {test,expect} from '@playwright/test'
import {seed,readRecords,touch,swipe} from './helpers'

test('iPhoneサイズのWebKitで2→3セットを同日上書きし、店舗をまたいでも挑戦回数を増やさない',async({page})=>{
  await seed(page)
  await page.getByRole('button',{name:'アシストディップ'}).click()
  await page.getByLabel('重量 (kg)').fill('40')
  await page.getByLabel('回数',{exact:true}).fill('10')
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'セット数を増やす'}).click()
  await page.getByRole('button',{name:'＋ 記録を保存'}).click()
  await expect.poll(()=>readRecords(page)).toHaveLength(1)
  const first=(await readRecords(page))[0]
  await page.getByRole('button',{name:'セット数を増やす'}).click()
  await page.getByRole('button',{name:'＋ 記録を保存'}).click()
  await expect.poll(async()=>(await readRecords(page))[0].sets).toBe(3)
  expect(await readRecords(page)).toHaveLength(1)
  expect((await readRecords(page))[0].id).toBe(first.id)
  await expect(page.getByLabel('直近の記録').getByRole('listitem')).toHaveCount(1)
  await expect(page.getByLabel('重量 (kg)')).toHaveValue('40')
  await expect(page.getByLabel('現在のセット数')).toHaveText('3')
  await expect(page.getByRole('button',{name:'種目選択に戻る'})).toHaveCount(0)
  await page.evaluate(()=>document.querySelector('.app')!.scrollTo(0,0))
  await swipe(page)
  await expect(page.getByLabel('種目一覧')).toBeVisible()
  await page.getByLabel('店舗を選択').selectOption('b')
  await page.getByRole('button',{name:'アシストディップ'}).click()
  await page.getByLabel('重量 (kg)').fill('45')
  await page.getByLabel('回数',{exact:true}).fill('8')
  await page.getByRole('button',{name:'セット数を増やす'}).click()
  await page.getByRole('button',{name:'＋ 記録を保存'}).click()
  await expect.poll(()=>readRecords(page)).toHaveLength(1)
  expect((await readRecords(page))[0].id).toBe(first.id)
})

test('WebKitで縦方向をキャンセルせず実スクロールでき、各設定画面からスワイプで戻る',async({page})=>{
  await seed(page)
  await page.getByRole('button',{name:'アシストディップ'}).click()
  // At the top the outward pull is stopped; this must not trigger Back.
  expect(await touch(page,[{x:6,y:100},{x:10,y:160},{x:12,y:240},{x:12,y:240}])).toBe(false)
  await expect(page.getByLabel('重量 (kg)')).toBeVisible()
  // Mobile WebKit automation has no native swipe/wheel API. Check actual scrollability,
  // uncancelled synthetic vertical events and touch-action separately; no real-device claim.
  await page.evaluate(()=>document.querySelector('.app')!.scrollBy(0,300))
  await expect.poll(()=>page.evaluate(()=>document.querySelector('.app')!.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(await page.locator('.swipe-back-screen').evaluate(el=>getComputedStyle(el).touchAction)).toContain('pan-y')
  await page.evaluate(()=>document.querySelector('.app')!.scrollTo(0,0))
  await swipe(page)
  for(const name of ['履歴','種目の管理','店舗設定','バックアップ・復元']){
    await page.getByLabel('店舗を選択').selectOption('__settings__')
    await page.getByRole('button',{name,exact:true}).click()
    await swipe(page)
    await expect(page.getByRole('navigation',{name:'設定メニュー'})).toBeVisible()
  }
  expect(await readRecords(page)).toEqual([])
})
