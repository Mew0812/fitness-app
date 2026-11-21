import {afterEach, expect, it, vi} from 'vitest'
const create=vi.hoisted(()=>vi.fn(()=>({auth:{}})))
vi.mock('@supabase/supabase-js',()=>({createClient:create}))
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();create.mockClear()})
it('未設定・秘密キーではクライアントを作らず、既存アプリを使用できる',async()=>{
  vi.stubEnv('VITE_SUPABASE_URL','https://test.supabase.co')
  for(const key of ['', 'sb_secret_DO_NOT_USE', 'eyJhbGciOi_fake_service_role']){
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY',key)
    vi.resetModules()
    const {supabase}=await import('./supabase')
    expect(supabase).toBeNull()
  }
  expect(create).not.toHaveBeenCalled()
})
it('Publishableキーのみでセッションを永続化し、通信タイムアウトを設定する',async()=>{
  vi.stubEnv('VITE_SUPABASE_URL','https://test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_test')
  const {supabase}=await import('./supabase')
  expect(supabase).toBeTruthy()
  expect(create).toHaveBeenCalledWith('https://test.supabase.co','sb_publishable_test',expect.objectContaining({
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:expect.any(Function)},
  }))
})
