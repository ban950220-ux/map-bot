import { test, expect, search, complete } from './fixtures.mjs';
import { LONG_NAME, LONG_ADDRESS } from './upstream.mjs';

async function contained(locator, width) {
  for(const element of await locator.all()) {
    const box=await element.boundingBox();
    expect(box,'element has a layout box').not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    const dimensions=await element.evaluate(el=>({tag:el.tagName,class:el.className,scroll:el.scrollWidth,client:el.clientWidth}));
    expect(dimensions.scroll,`content is not clipped horizontally: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.client+1);
  }
}
async function noOverflow(page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

for(const width of [360,390,430,768,1200])test(`responsive ${width}px: long content, keyboard selector, ambiguity, error, list-first map`,async({app:page,harness:h})=>{
  await page.setViewportSize({width,height:844});h.state.longText=true;
  for(const name of ['출발지','어떤 장소를 찾으세요?'])await expect(page.getByRole('textbox',{name,exact:true})).toBeVisible();
  const radius=page.getByRole('combobox',{name:'검색 반경',exact:true});
  await radius.focus();await expect(radius).toBeFocused();
  expect(await radius.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Space');await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(radius).toBeFocused();
  await contained(page.locator('#nearby-origin, #nearby-query, #nearby-radius, #nearby-count'),width);
  const button=page.getByRole('button',{name:'주변 장소 비교',exact:true});
  await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // Reduced viewport approximates available space above a keyboard; not a device keyboard certification.
  if(width<500){await page.setViewportSize({width,height:420});await page.getByLabel('출발지',{exact:true}).focus();await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();await page.setViewportSize({width,height:844});}
  await search(page);await complete(page);
  await expect(page.locator('.place-card').first()).toContainText(LONG_NAME);
  await expect(page.locator('.place-card').first()).toContainText(LONG_ADDRESS);
  await noOverflow(page);
  await contained(page.locator('.place-card, .place-select, .place-select h3, .place-select p, .place-metrics, .search-context, .ranking-tabs'),width);
  const list=await page.locator('.nearby-list').boundingBox(),map=await page.locator('.map-panel').boundingBox();
  expect(list.y+list.height).toBeLessThanOrEqual(map.y+1);
  const mapRegion=page.getByRole('region',{name:'출발지와 후보 목적지 지도'});
  expect((await mapRegion.boundingBox()).height).toBeLessThanOrEqual(420);
  await page.locator('.place-select').nth(1).focus();await page.keyboard.press('Enter');
  await expect(page.locator('.place-select').nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.map-selection[role=status]')).toContainText(LONG_NAME);
  await search(page,'카페','모호한 공공장소');
  const choices=page.getByRole('group',{name:'출발 장소 선택'});
  await expect(choices.getByRole('button')).toHaveCount(2);
  await contained(choices.getByRole('button'),width);await contained(page.getByRole('alert'),width);await noOverflow(page);
  await choices.getByRole('button').nth(1).focus();await page.keyboard.press('Enter');
  await expect(choices).toHaveCount(0);
  await button.click();await complete(page);await noOverflow(page);
});
