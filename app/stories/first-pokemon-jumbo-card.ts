import research from "@/docs/research/first-pokemon-jumbo-card.json";

const { images, sources, fx, release, rawSales, gradedSales, jpComparisons, heritageLot } = research;

function photo(key: keyof typeof images, alt: string, credit: string) {
  const { width, height } = images[key];
  return { src: `/specs/stories/first-jumbo/${key}.webp`, width, height, alt, credit };
}

const card = photo("card", "피카츄와 푸린과 삐삐가 같은 그림에 그려진 1997년 일본 코로코로 코믹 점보 카드 앞면", "피카츄와 푸린과 삐삐 · 1997년 일본판 무번호 프로모 · 니시다 아츠코");
const slab = photo("slab", "1997년 코로코로 점보 피카츄와 푸린과 삐삐가 대형 PSA EX-MT 6 케이스에 들어 있는 실물", "같은 점보 카드의 PSA 6 실물 · Cardova Japan");

function won(value: number) {
  return `약 ${(Math.round(value / 1000) * 1000).toLocaleString("ko-KR")}원`;
}

const rawKrw = rawSales.map((sale) => sale.usd * fx.usd);
const sortedRawKrw = [...rawKrw].sort((a, b) => a - b);
const middleRawKrw = (sortedRawKrw[Math.floor((sortedRawKrw.length - 1) / 2)] + sortedRawKrw[Math.floor(sortedRawKrw.length / 2)]) / 2;

function salePoint(sale: (typeof rawSales)[number] | (typeof gradedSales)[number]) {
  const krw = sale.usd * fx.usd;
  return {
    ...sale, amount: sale.usd, krw, won: won(krw), compactWon: won(krw),
    label: sale.date.slice(5), sourceLink: sources[sale.source as "misprint" | "priceCharting"],
    listing: sale.item ? `https://www.ebay.com/itm/${sale.item}` : null,
  };
}

export const firstJumboStory = {
  id: "85850fc0-23d3-458b-8795-e6bd1f9295f9",
  slug: "first-pokemon-jumbo-card",
  category: "promo",
  title: "첫 점보 포켓몬 카드를 책받침으로 쓰라고요?",
  summary: "일반 카드 다섯 장보다 넓은 피카츄·푸린·삐삐. 1997년 잡지 편집부가 권한 사용법부터, 이 카드가 들어간 PSA 케이스와 요즘 거래가까지 낋여왔습니다.",
  card: "피카츄와 푸린과 삐삐 · 코로코로 코믹 1997년 7월호 · 일본판 무번호 프로모",
  author: "뮤츠조아요",
  researchedOn: research.researchedOn,
  shareImage: {
    url: "/specs/stories/og-first-pokemon-jumbo-card.jpg", width: 1200, height: 630,
    alt: "1997년 코로코로 코믹 표지와 피카츄·푸린·삐삐 점보 카드를 함께 놓은 표지",
  },
  image: card,
  intro: [
    "안녕하세요 뮤츠조아요입니다. 오늘은 카드 한 장에 피카츄, 푸린, 삐삐를 다 넣고도 모자라 카드 자체를 책받침만 하게 만들어버린 이야기 낋여와봤습니다.",
    "점보 카드는 일반 포켓몬 카드보다 크게 만든 카드예요. 공식 포켓몬 카드 게임 카드 중 배포 기록을 거슬러 올라가 보니, 가장 먼저 만나는 건 1997년 일본에서 나온 〈피카츄와 푸린과 삐삐〉였습니다. 길이 21cm. 이름만 점보인 줄 알았는데, 자를 꺼내보면 A5 종이만 해요.",
    "저는 처음에 ‘이 정도면 상자 맨 위에 들어 있었겠지’ 싶었는데, 출발점은 두툼한 만화 잡지였습니다. 그리고 그 잡지에는 이걸 어떻게 갖고 놀아야 하는지 친절하게 적혀 있었어요. 첫 번째 용도가 진짜 책받침이었습니다.",
  ],
  size: {
    widthMm: release.widthMm, heightMm: release.heightMm,
    standardWidthMm: 63, standardHeightMm: 88,
    hero: photo("hero", "눈금이 있는 작업 매트에 놓인 1997년 점보 카드의 전체 앞면", "점보 카드 실물 · ENNDALGAMES"),
  },
  magazine: {
    title: "450엔짜리 만화책에서 나온 한 장",
    body: [
      "쇼가쿠칸이 발행한 일본 어린이 만화 잡지 『월간 코로코로 코믹』 통권 231호예요. 표지에는 큼지막하게 7월호라고 쓰여 있고, 발매 기록은 1997년 6월 15일을 가리킵니다. 일본 정규 카드 게임이 나온 지 1년도 안 됐을 때죠.",
      "당시 잡지 한 권은 450엔. 표지부터 미니카, 만화, 포켓몬 소식이 빼곡하고, 오른쪽에는 초대형 포켓몬 카드 부록이 있다는 문구가 보입니다. 이 호의 점보 부록은 피카츄·푸린·삐삐 세 마리가 함께 그려진 한 장이었어요. 잡지 옆에 두면 카드가 얼마나 컸는지 감이 더 잘 옵니다.",
    ],
    image: photo("magazine", "450엔 가격과 포켓몬 점보 부록 안내가 인쇄된 코로코로 코믹 1997년 7월호 표지", "월간 코로코로 코믹 1997년 7월호 · 통권 231호"),
    additionalImage: photo("bundle", "코로코로 코믹 7월호와 피카츄·푸린·삐삐 점보 카드 한 장을 나란히 놓은 원본 출품 사진", "당시 잡지와 점보 부록 1장 · Yahoo! 옥션 실물 사진"),
  },
  joke: {
    title: "130쪽을 펼치면, 편집부가 알려준 장난이 나옵니다",
    body: [
      "카드를 확대해서 아래쪽 빨간 코로코로 로고 뒤를 보세요. 7월호 부록이라는 말 옆에 잡지의 ‘포켓몬 클럽’ 130쪽을 보라고 적혀 있어요. 이 부분은 당시 문구를 옮긴 자료에서 확인했습니다. 크니까 노트 밑에 깔아 책받침으로 써 보라네요. 두 번째 제안은 친구랑 포켓몬 카드 대전을 하다가 이걸 갑자기 꺼내서 놀래키기였어요. 실제 카드 게임에는 사용할 수 없다는 설명도 함께 실렸고요.",
      "정작 카드의 기술도 한번 읽어볼 만합니다. 이름은 ‘이리 와’. 상대 벤치에 있는 포켓몬 한 마리를 내 벤치로 데려와 내 포켓몬처럼 취급하는 효과예요. HP는 세 마리 합쳐 카드 한 장에 60. 저는 귀여운 그림만 보다가 기술에서 한 번, 그걸 꺼내 친구를 놀래키라는 설명에서 한 번 더 웃었습니다.",
      "그림을 그린 사람은 니시다 아츠코입니다. 푸린이 앞쪽, 삐삐가 뒤쪽, 피카츄가 오른쪽에 있어요. 카드 제목에도 세 마리 이름이 그대로 들어갑니다. 1996년에도 코로코로가 피카츄와 푸린 카드를 배포했지만, 그쪽은 일반 크기의 두 장이었어요. 이듬해 이 카드에서는 셋이 처음부터 커다란 한 장에 함께 인쇄됐습니다.",
    ],
  },
  grading: {
    title: "이만한 게 PSA 케이스에 들어가요?",
    body: [
      "들어갑니다. 아래에 보이는 건 같은 일본 1997년 점보 프로모를 담은 PSA 6 실물이에요. 카드도 큰데 케이스를 보면 테두리 밖에 공간이 한 바퀴 더 생깁니다. PSA 공식 레지스트리에도 이 판본이 ‘COROCORO JUMBO’로 등록돼 있고, 헤리티지 경매에서도 같은 카드의 PSA 7을 확인했어요.",
      "PSA는 점보 홀더를 여러 크기로 안내합니다. 이 카드의 실물 규격은 약 145 × 210mm라, 접수를 알아볼 땐 카드 이름과 실측을 같이 알려줘야 해당 홀더를 확인할 수 있어요. CGC도 미국 접수표에 Jumbo Card 서비스가 있고 기본 요금은 원화로 약 2만 7천 원입니다. 이 1997년 판본의 CGC 인증 사례나 접수 확답은 확인하지 못했습니다. 배송·대행료는 별도예요.",
    ],
    image: slab,
  },
  market: {
    fx,
    rawCount: rawSales.length,
    rawRange: [won(Math.min(...rawKrw)), won(Math.max(...rawKrw))],
    rawMedian: won(middleRawKrw),
    rawTrend: rawSales.filter(({ condition }) => condition === "MP").map(salePoint),
    psa7Trend: gradedSales.filter(({ grade }) => grade === 7).map(salePoint),
    psa6: salePoint(gradedSales[1]),
    mercariSold: won(jpComparisons.mercariSold * fx.jpy),
    mercariLowSold: won(jpComparisons.mercariLowSold * fx.jpy),
    surugayaAsk: won(jpComparisons.surugayaAsk * fx.jpy),
    heritage: won(heritageLot.usd * fx.usd),
    sold: photo("sold", "주름이 있는 1997년 점보 프로모의 판매완료 상품 전체 앞면", "메루카리 판매완료품 · 전체 앞면"),
    wear: photo("sold-wear", "미감정 판매완료 점보 카드의 왼쪽 위 테두리와 주름이 보이는 사진", "메루카리 판매완료품의 주름 · 출품자 사진"),
  },
  closing: [
    "이 글을 쓰기 전에는 점보 카드면 그냥 같은 그림을 크게 뽑아준 물건인 줄 알았어요. 그런데 이 첫 장은 뒷이야기까지 같이 따라옵니다. 7월호 표지에서 점보 부록을 찾고, 카드 아래에서 130쪽을 찾고, 거기서 ‘책받침으로 써 봐’라는 글을 읽는 순서요.",
    "그래서 저는 이 카드를 다시 보면 PSA 숫자보다 먼저 왼쪽 아래 코로코로 로고를 볼 것 같아요. 맨날 부스터에서 나온 카드만 찾다가, 이번엔 만화책 한 권을 같이 기억하게 됐습니다.",
  ],
  links: Object.values(sources),
} as const;
