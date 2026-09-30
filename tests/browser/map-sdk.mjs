// Contract fake for the external SDK, not a mock of NearbyMap or React.
// Real marker DOM/click handlers and polyline coordinates originate in the app.
export function installMapSdk() {
  class Position { constructor(y, x) { this.y = y; this.x = x; } }
  class Bounds { extend() {} }
  class Map {
    constructor(element) {
      this.element = element;
      element.dataset.fakeMap = 'true';
      const pan = document.createElement('button'); pan.textContent = '테스트 지도 이동';
      pan.onclick = () => { element.dataset.panCount = String(Number(element.dataset.panCount || 0) + 1); };
      element.append(pan);
    }
    fitBounds() { this.element.dataset.fitted = 'true'; }
    setCenter() {}
    setSize() {}
    destroy() { this.element.replaceChildren(); }
  }
  class Marker {
    constructor(options) { this.node = options.icon.content; this.node.dataset.markerPosition = JSON.stringify(options.position); options.map.element.append(this.node); }
    setMap(map) { if (!map) this.node.remove(); }
  }
  class Polyline {
    constructor(options) {
      this.node = document.createElement('div'); this.node.dataset.polyline = JSON.stringify(options.path);
      this.node.setAttribute('aria-label', '테스트 선택 경로선'); options.map.element.append(this.node);
    }
    setMap(map) { if (!map) this.node.remove(); }
  }
  window.naver = { maps: { Map, Marker, Polyline, LatLng: Position, LatLngBounds: Bounds, Size: Position, Point: Position } };
}
