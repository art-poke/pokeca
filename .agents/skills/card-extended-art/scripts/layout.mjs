// Run from the repository after cropping the source to the physical card outline.
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [mode, format, cardFile, directory, inputFile] = process.argv.slice(2);
const profiles = {
  sleeve: { width: 204, height: 276, grid: true },
  toploader: { width: 246, height: 315, grid: true },
  psa: { width: 80, height: 135, label: [6, 5, 68, 20], cardY: 37 },
  brg: { width: 80, height: 135, label: [7, 8.5, 66, 23], cardY: 39 },
};
const selected = format === "9pocket" ? ["sleeve", "toploader"] : [format];
if (!["guide", "render"].includes(mode) || !selected.every(k => Object.hasOwn(profiles, k))
    || !cardFile || !directory || (mode === "render" && !inputFile)) {
  throw Error("node layout.mjs guide|render 9pocket|sleeve|toploader|psa|brg CARD NEW_DIRECTORY [ANALYSIS_JSON for guide | REGISTERED_ART for render]");
}
const px = mm => Math.round(mm * 300 / 25.4);
const center = (outer, inner) => Math.round((outer - inner) / 2);
const largest = profiles[selected.at(-1)];
const size = (p) => ({ width: px(p.width), height: px(p.height) });
const master = size(largest);
const card = await sharp(cardFile).rotate().resize(px(63), px(88), { fit: "inside" }).png().toBuffer({resolveWithObject:true});
if (Math.abs(card.info.width / card.info.height / (63 / 88) - 1) > 0.04) {
  throw Error("원본에서 카드 프레임만 자른 뒤 다시 실행하세요. 카드 비율과 차이가 큽니다.");
}
function position(p) {
  const {width, height} = size(p);
  return {left:center(width,card.info.width), top:p.grid ? center(height,card.info.height) : px(p.cardY)};
}
function blank(width,height,background) {
  return sharp({create:{width,height,channels:4,background}});
}
function guideLines(width,height) {
  const lines = [1,2].flatMap(n => [
    'M'+Math.round(width*n/3)+' 0v'+height,
    'M0 '+Math.round(height*n/3)+'h'+width,
  ]).join(' ');
  return Buffer.from('<svg width="'+width+'" height="'+height+'"><path d="'+lines+'" stroke="#25202c" stroke-width="2.5" opacity=".55"/><path d="'+lines+'" stroke="white" stroke-width="1" opacity=".8"/></svg>');
}
function labelRect(p) {
  const [x,y,w,h] = p.label.map(px);
  return {left:x,top:y,width:w,height:h};
}
function mapEdges(analysis, targetCard) {
  const [, , sourceWidth, sourceHeight] = analysis.geometry.card_in_input_px;
  const [x, y, w, h] = analysis.geometry.art_in_card_px;
  if (![sourceWidth, sourceHeight, x, y, w, h].every(Number.isFinite)
      || Math.min(w, h) <= 0 || x < 0 || y < 0 || x + w > sourceWidth || y + h > sourceHeight) {
    throw Error("분석의 카드 외곽과 그림 창 좌표를 확인하세요.");
  }
  const mapped = {};
  const ids = new Set();
  for (const side of ["top", "right", "bottom", "left"]) {
    const entries = analysis.edges[side];
    if (!Array.isArray(entries) || !entries.length) throw Error(side + " 경계 기록이 비어 있습니다.");
    const vertical = side === "left" || side === "right";
    mapped[side] = entries.map(({ id, span_pct: span }) => {
      if (typeof id !== "string" || !id.trim() || ids.has(id) || !Array.isArray(span) || span.length !== 2
          || !span.every(n => Number.isFinite(n) && n >= 0 && n <= 100) || span[1] < span[0]) {
        throw Error(side + " 경계의 ID 또는 span_pct 값을 확인하세요.");
      }
      ids.add(id);
      const segment = span.map(percent => {
        const sx = vertical ? x + (side === "right" ? w : 0) : x + w * percent / 100;
        const sy = vertical ? y + h * percent / 100 : y + (side === "bottom" ? h : 0);
        return [
          targetCard.left + Math.round(sx * targetCard.width / sourceWidth),
          targetCard.top + Math.round(sy * targetCard.height / sourceHeight),
        ];
      });
      return { id, segment_px: segment };
    });
  }
  return mapped;
}
const target = path.resolve(directory);
let registered;
if (mode === "render") {
  const meta = await sharp(inputFile).metadata();
  if (Math.abs(meta.width - meta.height * master.width / master.height) > 1.5) {
    throw Error("생성 그림의 비율이 가이드와 다릅니다. 원본 랜드마크로 정렬하고 마스터 비율에 맞춰 크롭하세요.");
  }
  registered = await sharp(inputFile).resize(master.width,master.height,{fit:"cover"}).ensureAlpha().png().toBuffer();
}
const save = (pipeline, name) => pipeline.withMetadata({density:300}).png().toFile(path.join(target,name));
if (mode === "guide") {
  const analysis = inputFile ? JSON.parse(await readFile(inputFile, "utf8")) : null;
  const layout = { master: selected.at(-1), profiles: {} };
  for(const key of selected) {
    const p = profiles[key];
    const box = {...position(p), width:card.info.width, height:card.info.height};
    const spec = {canvas:size(p), card:box, label:p.label && labelRect(p)};
    console.log(key, JSON.stringify(spec));
    layout.profiles[key] = analysis ? {...spec, edges:mapEdges(analysis, box)} : spec;
  }
  await mkdir(target, {recursive:false});
  await save(blank(master.width,master.height,"#707078").composite([{input:card.data,...position(largest)}]),"guide.png");
  await writeFile(path.join(target,"layout.json"), JSON.stringify(layout, null, 2) + "\n");
} else {
  await mkdir(target, {recursive:false});
  const items=[];
  for(const key of selected) {
    const p=profiles[key],{width,height}=size(p);
    const cardPos=position(p);
    const scene=await sharp(registered).extract({width,height,left:center(master.width,width),top:center(master.height,height)}).png().toBuffer();
    const download=key+".png";
    let preview=download;
    if(p.grid) {
      await save(sharp(scene).composite([{input:card.data,...cardPos},{input:guideLines(width,height)}]),download);
    } else {
      const rects=[{...cardPos,width:card.info.width,height:card.info.height},labelRect(p)];
      const holes=await Promise.all(rects.map(async ({left,top,width:w,height:h})=>({
        left,top,input:await blank(w,h,"#ffffff").png().toBuffer(),blend:"dest-out"
      })));
      await save(sharp(scene).composite(holes),download);
      preview=key+"-preview.png";
      await save(sharp(path.join(target,download)).composite([{input:card.data,...cardPos}]),preview);
    }
    items.push({key,download,preview,caption:p.width+" × "+p.height+" mm · 300 DPI"+(p.grid?"":" · 창 위치는 도면 기준 추정")});
  }
  const labels={sleeve:"슬리브",toploader:"탑로더",psa:"PSA",brg:"BRG"};
  const nav=items.map((v,i)=>'<button data-i="'+i+'" aria-pressed="'+(i===0)+'">'+labels[v.key]+'</button>').join(" ");
  await writeFile(path.join(target,"preview.html"),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>확장아트 미리보기</title>
<style>body{margin:0;text-align:center;background:#181820;color:#f5f2fa;font:16px system-ui}header{padding:12px}button,a{font:inherit;color:inherit;background:#393443;padding:6px 12px;border:0;border-radius:5px}button[aria-pressed=true]{background:#665b80}img{max-width:96vw;max-height:84vh;object-fit:contain}p{margin:.6em}</style>
<header>${nav} <a id="download" download>인쇄 PNG 다운로드</a><p id="caption"></p></header><img id="art" alt="선택한 규격의 확장아트">
<script>const items=${JSON.stringify(items)};function show(i){const v=items[i];document.querySelector("#art").src=v.preview;document.querySelector("#download").href=v.download;document.querySelector("#caption").textContent=v.caption;for(const b of document.querySelectorAll("button"))b.setAttribute("aria-pressed",String(Number(b.dataset.i)===i))}for(const b of document.querySelectorAll("button"))b.onclick=()=>show(Number(b.dataset.i));show(0)</script></html>`);
}
