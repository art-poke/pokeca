// Reusable design-reference extractor for ego-browser rounds.
// Usage (inside an ego-browser nodejs round):
//   const { captureSite } = await import(".../extract.mjs");
//   await captureSite(page, { label, url, width, height, mobile, outDir });

const PAGE_FN = () => {
  const topN = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ v: k, count: v }));
  const bump = (obj, key) => { if (!key) return; obj[key] = (obj[key] || 0) + 1; };
  const fontSize = {}, fontWeight = {}, lineHeight = {}, color = {}, bg = {}, radius = {}, shadow = {}, fontFamily = {}, gap = {}, pad = {}, borderColor = {};
  const els = Array.from(document.querySelectorAll("body *")).slice(0, 5000);
  for (const el of els) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    bump(fontSize, cs.fontSize);
    bump(fontWeight, cs.fontWeight);
    bump(lineHeight, cs.lineHeight);
    bump(fontFamily, (cs.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim());
    if (el.textContent && el.textContent.trim().length > 0) bump(color, cs.color);
    if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") bump(bg, cs.backgroundColor);
    if (cs.borderRadius && cs.borderRadius !== "0px") bump(radius, cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== "none") bump(shadow, cs.boxShadow);
    if (cs.gap && cs.gap !== "normal" && cs.gap !== "0px") bump(gap, cs.gap);
    if (cs.borderTopWidth !== "0px" && cs.borderTopColor) bump(borderColor, cs.borderTopColor);
    bump(pad, cs.padding);
  }
  const rootVars = {};
  try {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes(":root")) {
          for (const p of rule.style) { if (p.startsWith("--")) rootVars[p] = rule.style.getPropertyValue(p).trim(); }
        }
      }
    }
  } catch (e) {}
  const breakpoints = new Set();
  try {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules) {
        if (rule.media && rule.conditionText) {
          const m = rule.conditionText.match(/(\d+)px/g);
          if (m) m.forEach((x) => breakpoints.add(parseInt(x, 10)));
        }
      }
    }
  } catch (e) {}
  const buttons = Array.from(document.querySelectorAll("button, a[class*=button], a[class*=btn], [role=button]")).slice(0, 12).map((b) => {
    const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
    return { text: (b.textContent || "").trim().slice(0, 20), h: Math.round(r.height), padding: cs.padding, radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, border: cs.border };
  });
  const inputs = Array.from(document.querySelectorAll("input, textarea, select")).slice(0, 6).map((b) => {
    const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
    return { type: b.type || b.tagName, h: Math.round(r.height), padding: cs.padding, radius: cs.borderRadius, bg: cs.backgroundColor, border: cs.border, fontSize: cs.fontSize };
  });
  const containers = Array.from(document.querySelectorAll("main, section, [class*=container], [class*=Container], [class*=wrap], [class*=inner]")).slice(0, 30).map((c) => {
    const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), maxWidth: cs.maxWidth, px: cs.paddingLeft };
  }).filter((c) => c.w > 300);
  return {
    title: document.title,
    fontFamily: topN(fontFamily, 8),
    fontSize: topN(fontSize, 25),
    fontWeight: topN(fontWeight, 10),
    lineHeight: topN(lineHeight, 12),
    color: topN(color, 24),
    bg: topN(bg, 24),
    borderColor: topN(borderColor, 12),
    radius: topN(radius, 15),
    shadow: topN(shadow, 10),
    gap: topN(gap, 15),
    padding: topN(pad, 15),
    rootVarsCount: Object.keys(rootVars).length,
    rootVars,
    breakpoints: Array.from(breakpoints).sort((a, b) => a - b),
    buttons, inputs, containers,
    viewport: { w: innerWidth, h: innerHeight },
  };
};

export async function captureSite(page, { label, url, width, height, mobile, outDir }) {
  const fs = await import("node:fs/promises");
  await page.cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: !!mobile });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const shot = await page.screenshot({ path: `${outDir}/screenshots/${label}.png`, fullPage: false });
  const data = await page.evaluate(PAGE_FN);
  await fs.writeFile(`${outDir}/data/${label}.json`, JSON.stringify(data, null, 2));
  return {
    label, screenshot: shot, title: data.title,
    fontFamily: data.fontFamily.map((f) => f.v).slice(0, 3),
    fontSizeTop: data.fontSize.slice(0, 8).map((f) => f.v),
    radiusTop: data.radius.slice(0, 6).map((f) => f.v),
    breakpoints: data.breakpoints,
    rootVarsCount: data.rootVarsCount,
    primaryButton: data.buttons.find((b) => b.bg !== "rgba(0, 0, 0, 0)") || data.buttons[0],
    maxWidths: [...new Set(data.containers.map((c) => c.maxWidth).filter((m) => m !== "none"))].slice(0, 6),
  };
}
