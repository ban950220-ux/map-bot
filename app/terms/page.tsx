import Link from "next/link";

export default function TermsPage() {
  return <main className="site-shell legal-page">
    <header className="site-header"><Link href="/" className="brand">가까운 한 끼</Link></header>
    <article className="panel">
      <h1>이용조건</h1>
      <p>이 사이트는 목적지를 정하기 전 여러 장소의 자동차 예상시간·도로거리·주차정보를 비교하도록 돕는 개인용 도구입니다. 표시 정보는 제공자 데이터와 조회 시점에 따라 달라질 수 있으므로 출발 전 실제 장소와 길찾기 서비스에서 다시 확인하세요.</p>
      <h2>매장 주차정보</h2>
      <p>Google Places가 확실히 일치하는 장소에서 하나 이상의 주차 옵션을 확인한 경우에만 “가능”으로 표시합니다. 정보가 없거나 일치가 불확실하면 “확인 필요”이며, 인근 주차장의 존재는 매장 자체 주차 가능을 뜻하지 않습니다.</p>
      <h2>외부 서비스</h2>
      <p>이 사이트의 Google Maps Platform 사용에는 <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noopener noreferrer">Google Maps Platform 이용약관</a>과 <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google 서비스 약관</a>이 적용됩니다. Kakao Local과 NAVER Maps 사용도 각 제공자의 이용조건을 따릅니다.</p>
      <Link href="/">검색 화면으로 돌아가기</Link>
    </article>
  </main>;
}
