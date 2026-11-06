// 한글 오타 허용 검색용 자모 분해 + 유사도.
//
// 사람들은 "피카츄"를 "피카추", "핔카츄"처럼 받침/모음 한 끗 차이로 자주 틀린다.
// 음절 단위 trigram만으로는 "핔"↔"피"처럼 받침이 생기면 전혀 다른 글자로 취급돼 못 잡는다.
// 그래서 음절을 초성·중성·종성 자모로 펼친 뒤(피카츄→ㅍㅣㅋㅏㅊㅠ) 자모 레벤슈타인으로 잰다.
// 이러면 한 글자 오타가 자모 1~2개 차이로 줄어 유사도가 높게 나온다.

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
// 종성(28): 첫 칸은 받침 없음.
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

// 완성형 한글 음절을 자모 문자열로 편다. 한글이 아닌 문자는 그대로 둔다.
export function decomposeJamo(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00;
      out += CHO[Math.floor(s / 588)] + JUNG[Math.floor((s % 588) / 28)] + JONG[s % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// 두 문자열의 자모 레벤슈타인 유사도(0~1). 길이가 다르면 긴 쪽 기준.
export function jamoSimilarity(a: string, b: string): number {
  const ja = decomposeJamo(a.trim().toLowerCase());
  const jb = decomposeJamo(b.trim().toLowerCase());
  const max = Math.max(ja.length, jb.length);
  if (max === 0) return 0;
  return 1 - levenshtein(ja, jb) / max;
}
