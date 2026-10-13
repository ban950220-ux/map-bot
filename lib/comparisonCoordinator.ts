// Both comparison panels remain mounted while switching tabs. Keep one active
// comparison in this browser page so switching tabs preserves its results
// without starting a second stream of paid route requests.
let active = false;

export function beginComparison() {
  if (active) throw new Error("다른 경로 조회가 진행 중입니다. 완료되거나 중단된 뒤 다시 시도해 주세요.");
  active = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = false;
  };
}
