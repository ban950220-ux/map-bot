import Link from 'next/link';
export default function InstallPage() {
  return <main style={{maxWidth:640, margin:'auto', padding:24}}><h1>가까운 한 끼 앱 설치</h1><p>Android Chrome: 브라우저 메뉴에서 앱 설치를 선택하세요. iPhone Safari: 공유 메뉴에서 홈 화면에 추가 후 웹 앱으로 열기를 선택하세요. 설치 메뉴의 제공 여부는 기기와 브라우저에 따라 달라집니다.</p><p>이 앱은 인터넷 연결이 필요합니다. 위치·검색 결과는 오프라인 캐시에 저장하지 않습니다. 로그인 세션은 최대 1시간 후 만료됩니다.</p><Link href="/" style={{display:'inline-block',padding:12}}>지도로 돌아가기</Link></main>;
}
