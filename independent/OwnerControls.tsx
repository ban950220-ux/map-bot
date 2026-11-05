'use client';
import { useEffect } from 'react';
export default function OwnerControls() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {}); }, []);
  return <aside style={{padding: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px'}} aria-label="독립 앱 계정"><a href="/install" style={{minHeight:44, display:'inline-flex', alignItems:'center'}}>앱 설치 안내</a><form action="/auth/logout" method="post" onSubmit={() => sessionStorage.clear()}><button style={{minHeight:44, padding:'8px 16px'}}>로그아웃</button></form></aside>;
}
