/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the broken Vinext RSC Link prefetch path. */
export default function TermsPage() {
  return <main className="site-shell legal-page">
    <header className="site-header"><a href="/" className="brand">가까운 한 끼</a></header>
    <article className="panel">
      <h1>이용조건</h1>
      <p>이 사이트는 목적지를 정하기 전 여러 장소의 자동차 예상시간·도로거리·주차정보를 비교하도록 돕는 개인용 도구입니다. 표시 정보는 제공자 데이터와 조회 시점에 따라 달라질 수 있으므로 출발 전 실제 장소와 길찾기 서비스에서 다시 확인하세요.</p>
      <h2>매장 주차정보</h2>
      <p>현재 매장 자체 주차 여부는 “확인 필요”로 표시합니다. Kakao Local에서 찾은 500m 이내 인근 주차장은 별도 장소이며, 그 존재는 매장 자체 주차 가능을 뜻하지 않습니다.</p>
      <h2>외부 서비스</h2>
      <p>이 사이트는 Kakao Local과 NAVER Maps를 사용하며 각 제공자의 이용조건을 따릅니다.</p>
      <a href="/">검색 화면으로 돌아가기</a>
    </article>
  </main>;
}
