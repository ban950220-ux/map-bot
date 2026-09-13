import Link from "next/link";

export default function PrivacyPage() {
  return <main className="site-shell legal-page">
    <header className="site-header"><Link href="/" className="brand">가까운 한 끼</Link></header>
    <article className="panel">
      <h1>개인정보 및 데이터 이용 안내</h1>
      <p>이 사이트는 소유자의 ChatGPT 로그인으로 보호되는 개인용 장소·경로 비교 도구입니다. 별도의 사용자 계정 DB나 검색 기록 DB를 운영하지 않습니다.</p>
      <h2>외부 서비스 전송</h2>
      <p>검색을 수행하면 출발지·검색어·후보 좌표 등 필요한 최소 정보가 Kakao Local, NAVER Maps, Google Places API에 전송됩니다. 각 서비스의 처리는 해당 제공자의 정책을 따릅니다.</p>
      <h2>브라우저 저장</h2>
      <p>중단된 검색을 30분 안에 이어가기 위한 정보가 현재 브라우저의 sessionStorage에 임시 저장될 수 있습니다. Google Places에서 받은 매장 주차정보와 경로선 좌표는 저장하지 않습니다.</p>
      <h2>비밀정보</h2>
      <p>외부 API 비밀키는 서버에서만 사용하며 브라우저 응답에 포함하지 않습니다.</p>
      <p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a> · <a href="https://www.kakao.com/policy/privacy" target="_blank" rel="noopener noreferrer">Kakao 개인정보처리방침</a> · <a href="https://www.navercorp.com/policy/privacy" target="_blank" rel="noopener noreferrer">NAVER 개인정보처리방침</a></p>
      <Link href="/">검색 화면으로 돌아가기</Link>
    </article>
  </main>;
}
