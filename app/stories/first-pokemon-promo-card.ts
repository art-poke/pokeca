import research from "@/docs/research/first-pokemon-promo-card.json";

const { images, sources, shareImage, market, logan } = research;

function photo(key: keyof typeof images, alt: string) {
  const { width, height, credit } = images[key];
  return { src: `/specs/stories/first-promo/${key}.webp`, width, height, alt, credit };
}

const pikachu = photo("pikachu", "담쟁이 잎 앞 피카츄와 하단의 Ken Sugimori 표기가 보이는 1996년 일본판 프로모 앞면");
const jigglypuff = photo("jigglypuff", "덩굴과 열매 앞에 푸린이 서 있는 1996년 일본판 프로모 앞면");

function won(usd: number) {
  const units = Math.round(usd * market.usdToKrw / 10_000);
  if (units < 10_000) return `약 ${units.toLocaleString("ko-KR")}만 원`;
  const remainder = units % 10_000;
  return `약 ${Math.floor(units / 10_000)}억${remainder ? ` ${remainder.toLocaleString("ko-KR")}만` : ""} 원`;
}

const sales = Object.values(market.sales).map((sale) => ({
  ...sale,
  krw: sale.usd * market.usdToKrw,
  won: won(sale.usd),
}));

const privateSalePhotos = [
  photo("cgc-original", "작가가 Ken Sugimori로 표기된 1996년 아이비 피카츄 잡지 부록판 CGC Gem Mint 10 실물"),
  photo("cgc-marketing", "피카츄의 발밑에 담쟁이 잎이 보이는 사전 홍보판 CGC 8.5 실물"),
];

export const firstPromoStory = {
  id: "9ed47756-5851-4f52-a22a-83e795e53a6f",
  slug: "first-pokemon-promo-card",
  category: "promo",
  title: "최초의 포켓몬 프로모 카드는 무엇일까?",
  summary: "첫 카드 팩보다 닷새 빨랐던 만화책 부록. 30년 뒤 로건 폴이 그 잡지에서 카드를 직접 떼어냈어요. 피카츄는 과연 몇 점을 받았을까요?",
  card: "피카츄와 푸린 · 1996년 일본 코로코로 코믹 부록",
  author: "뮤츠조아요",
  researchedOn: research.researchedOn,
  shareImage: {
    url: shareImage.path,
    width: shareImage.width,
    height: shareImage.height,
    alt: "최초의 포켓몬 프로모 카드는 무엇일까? 1996년 코로코로의 피카츄와 푸린 카드",
  },
  image: pikachu,
  intro: [
    "안녕하십니까 뮤츠조아요입니다. 잡지 부록이나 행사에서 주는 프로모 카드 있잖아요. 맨 처음엔 어떤 포켓몬을 줬을까 궁금해서 한번 찾아봤습니다!",
    "찾아보니 1996년 일본 만화 잡지에서 피카츄랑 푸린을 같이 줬더라고요. 피카츄는 왠지 그럴 것 같았는데 푸린도 처음부터 같이 있었다니 좀 의외였어요.",
    "근데 저는 날짜가 더 신기했습니다. 이 잡지가 첫 포켓몬 카드 팩보다 먼저 나왔거든요.",
  ],
  magazine: {
    title: "일단 이 만화책부터 펴볼게요",
    body: [
      "일본 쇼가쿠칸에서 낸 어린이 만화 잡지 《월간 코로코로 코믹》 1996년 11월호입니다. 표지 왼쪽 위쯤을 보면 그림들 사이에 피카츄 카드가 조그맣게 들어가 있어요. 그 위에 포켓몬 카드가 공식 부록이라고 써 있고요. 저는 오른쪽 위에 입 쩍 벌리고 있는 도라에몽부터 봤습니다. 표지가 아주 정신없고 좋네요.",
    ],
    image: photo("magazine", "왼쪽에 피카츄 카드 부록 표시, 오른쪽 위에 도라에몽이 있는 코로코로 코믹 1996년 11월호 표지"),
    afterImage: [
      "책 안에는 피카츄랑 푸린이 둘 다 들어 있었습니다. 사진을 보면 옛날 일본판 특유의 몬스터볼 뒷면이 보이죠. 포장을 뜯는 대신 잡지에 끼워진 부록지에서 한 장씩 떼어내는 방식이에요. 둘 다 표면에 광택을 낸 카드였고요. 저라면 한 장 떼고 나서 남은 한 장도 모서리 안 구겨지게 한참 붙들고 있었을 것 같아요.",
    ],
  },
  insert: photo("insert", "펼친 코로코로 코믹 위로 몬스터볼 뒷면이 보이는 카드 두 장이 나란히 붙은 부록지"),
  dates: {
    title: "잠깐만요, 11월호가 10월에 나왔다고요?",
    body: [
      "이게 처음 찾아볼 때 제일 헷갈렸어요. 표지엔 11월호라고 큼직하게 써 있잖아요. 그런데 바로 전 호의 예고 지면을 확대해서 왼쪽 아래를 보시면 ‘11월호 10월 15일 발매’라고 적혀 있습니다. 위쪽엔 피카츄와 푸린 카드를 먼저 준다는 얘기도 있고요.",
    ],
    image: photo("preview", "피카츄·푸린 부록과 왼쪽 아래 11월호 10월 15일 발매 안내가 보이는 코로코로 10월호의 예고 지면"),
    afterImage: [
      "포켓몬 공식 연표를 열어보니 일본의 첫 확장팩과 스타터팩은 1996년 10월 20일에 나왔습니다. 잡지가 닷새 먼저예요. 만화 보려고 책을 폈는데, 가게에 카드 팩이 깔리기도 전에 포켓몬 카드가 두 장 생긴 거죠. 두 장은 나중에 정식 카드 게임에서도 쓸 수 있었고요. 닷새 동안 친구한테 보여주기 딱 좋았겠는데요?",
      "그보다 이른 9월에는 반다이의 포켓몬 카드다스도 있었습니다. 그쪽은 자판기로 팔던 별도의 수집 카드예요. 오늘 얘기하는 ‘최초’는 포켓몬 카드 게임에서 일반 독자에게 배포한 프로모 기준입니다.",
    ],
  },
  faces: {
    title: "피카츄 아래에 적힌 이름, 한번 보세요",
    body: [
      "앞면을 나란히 놓으니 둘 다 배경에 초록이 많아요. 피카츄는 담쟁이 잎 앞에 서 있고, 푸린은 열매가 달린 덩굴 앞에 있습니다. 피카츄 쪽은 저 잎 때문에 ‘아이비 피카츄’라고 불려요. 피카츄 볼에 빨간 점 두 개가 오돌토돌 붙어 있는 것 같은데, 이 옛날 3D 느낌이 저는 자꾸 눈에 들어옵니다.",
    ],
    gallery: [pikachu, jigglypuff],
    afterImage: [
      "그리고 피카츄 왼쪽 아래를 확대해보세요. ‘Ken Sugimori’라고 적혀 있는데, 실제로 이 그림을 만든 사람은 기네부치 케이지(Keiji Kinebuchi)예요. 푸린 카드에는 그 이름이 제대로 들어가 있습니다. 피카츄만 이름표를 잘못 달고 먼저 나왔네요.",
      "같은 해 11월엔 카드 게임 입문서에 두 그림이 무광으로 다시 나왔습니다. 그때 피카츄의 작가 표기는 기네부치로 바로잡혔고요. 하단의 025랑 039는 도감 번호라서, 이 숫자만으로는 처음 나온 부록인지 가리기 어려워요. 특히 푸린은 같은 그림끼리 사진으로 보면 헷갈릴 만합니다. 광택은 빛을 비스듬히 받을 때 더 잘 보여요.",
    ],
  },
  logan: {
    title: "근데 이걸 로건 폴이 진짜 떼더라고요",
    body: [
      "저라면 모서리 구겨질까 봐 손도 못 댈 것 같은데, 2026년 7월에 유튜버 로건 폴이 진짜로 223호를 폈습니다. 노린 건 이 피카츄의 PSA 10이었어요. PSA는 카드 상태를 감정하는 회사고, 10은 거기서 받을 수 있는 가장 높은 등급입니다.",
      "영상 22분쯤에 양손으로 부록지를 잡고 살살 벌리는데, 떼는 소리까지 들려요. 저는 이미 30년 된 물건이라는 걸 알고 봐서 그런지 손에 힘이 들어가더라고요. 푸린도 같이 떼고 두 장을 감정에 보냅니다. 그래서 몇 점이 나왔냐면요.",
    ],
    image: photo("logan-peel", "로건 폴이 펼친 코로코로 코믹 223호에서 카드가 붙은 부록지를 양손으로 벌리는 장면"),
    afterImage: [
      `피카츄 ${logan.magazinePeel.pikachu}, 푸린 ${logan.magazinePeel.jigglypuff}. 푸린이 2라니, 저도 숫자를 다시 봤어요. 본편에서 다른 감정사에 다시 가져갔을 때는 앞면 사진만으론 잘 안 보이던 꺾임도 드러납니다. 부록지에 카드가 붙어 있다는 사실만으로 상태를 다 알 수는 없었던 거죠.`,
      `7월 30일엔 방송에서 또 떼어봤습니다. 이번엔 잡지에 묶이기 전의 제작 샘플이었고, 로건 폴은 그 종이 한 장에 ${won(logan.preproductionPeel.selfReportedSheetUsd)}을 썼다고 했어요. 8월에 공개한 결과는 피카츄 ${logan.preproductionPeel.pikachu}, 푸린 ${logan.preproductionPeel.jigglypuff}. 피카츄가 드디어 9까지 갔네요. 저라면 그 숫자 보고 엄청 좋아했을 텐데, 이분은 10을 보겠다고 10월에도 다시 방송을 켰습니다.`,
    ],
  },
  videos: [sources.loganMagazine, sources.loganGrades, sources.loganOctober],
  marketIntro: {
    title: "그래서 지금 피카츄 한 장에 얼마예요?",
    body: [
      `저도 숫자가 제일 궁금해서 223호의 광택 피카츄 단품만 찾아봤습니다. 4월에 패너틱스에서 거래된 PSA 4가 ${won(market.sales.psa4April.usd)}이었어요. 영상에서 피카츄가 5를 받고 아쉬워하던 장면을 보다가 이 가격을 보니 기분이 좀 묘합니다. 상태만 봤을 때랑 가격표까지 옆에 뒀을 때랑 느낌이 확 다르네요.`,
      `11월에 확인한 판매 기록은 PSA 7이 ${won(market.sales.psa7November.usd)}, PSA 8이 ${won(market.sales.psa8November.usd)}이었습니다. PSA 8은 10월 26일엔 ${won(market.sales.psa8October.usd)}이었어요. 같은 등급도 물건이 바뀌면 찍히는 금액이 다르더라고요. 저는 11월 거래부터 보고, 같은 등급의 앞선 기록도 같이 펼쳐봤습니다.`,
      `11월 9일에는 ${won(market.sales.psa9ocNovember.usd)}에 끝난 PSA 9 (OC)도 있었습니다. OC는 카드의 테두리 여백이 한쪽으로 쏠렸다는 표기예요. 라벨에 붙은 작은 ‘OC’까지 봐야 어떤 9였는지 알 수 있더라고요.`,
    ],
  },
  market: {
    checkedOn: market.checkedOn,
    usdToKrw: market.usdToKrw,
    sales,
    photos: [
      photo("psa4", "2026년 4월 경매에서 거래된 잡지 부록판 아이비 피카츄 PSA 4 앞면과 라벨"),
      photo("psa7", "2026년 9월 21일 경매에서 거래된 잡지 부록판 아이비 피카츄 PSA 7 앞면과 라벨"),
      photo("psa8", "2026년 11월 2일 경매에서 거래된 잡지 부록판 아이비 피카츄 PSA 8 앞면과 라벨"),
      photo("psa9oc", "2026년 11월 9일 경매에서 거래된 잡지 부록판 아이비 피카츄 PSA 9 OC 앞면과 라벨"),
    ],
  },
  expensive: {
    title: "근데 검색하다 보면 갑자기 억 단위가 튀어나와요",
    body: [
      `CGC라는 감정 회사가 2026년 8월에 이뤄진 개인 거래 두 건을 공개했는데요. 왼쪽은 우리가 보고 있던 작가 이름이 잘못 찍힌 잡지 부록이에요. 이 판본의 CGC Gem Mint 10 한 장이 ${won(market.privateSales[0].usd)}에 거래됐다고 합니다.`,
      `오른쪽은 발밑에 담쟁이 잎이 붙어 있는 사전 홍보판입니다. 카드 아래에 기네부치 이름도 제대로 들어가 있어요. 이쪽은 CGC 8.5 한 장이 ${won(market.privateSales[1].usd)}에 거래됐다고 하고요. 저도 처음엔 담쟁이 배경만 보고 같은 피카츄인 줄 알았는데, 보고 있던 자리가 발밑이었어야 했네요.`,
    ],
    gallery: privateSalePhotos,
    afterImage: [
      `카드를 떼지 않고 잡지째 남겨둔 경우도 있어요. 헤리티지에서 2026년 9월 18일에 두 카드가 붙은 채로 남은 223호 한 권이 ${won(market.magazineSaleUsd)}에 팔렸습니다. 잡지에 매겨진 등급이 BGS 6이고, 금액은 구매자 수수료가 포함된 거예요. 이 가격을 보고 부록 사진을 다시 보니까, 그대로 덮어두는 것도 이해가 가네요. 한 장 떼면 두 마리가 같이 붙어 있던 그 모습은 끝이잖아요.`,
    ],
  },
  closing: {
    title: "저는 앨범에 두 칸 비워둘 것 같아요",
    body: [
      "그래서 최초의 포켓몬 카드 게임 프로모는 1996년 10월 15일, 코로코로 코믹 11월호에서 같이 나온 피카츄와 푸린입니다. 처음엔 한 장 이름만 알면 끝날 줄 알았는데, 만화책 표지까지 확대해서 보고 있더라고요. 하하.",
      "저라면 이미 떨어져 있는 피카츄를 구해서 앨범에 넣고, 바로 옆 칸은 푸린 자리로 비워둘 것 같아요. 두 장이 다 붙어 있는 잡지를 구했다면요? 음… 일단 잡지는 그냥 덮어두겠습니다. 로건 폴 떼는 거 보는 걸로도 손에 땀이 충분히 났어요 ㅋㅋㅋ",
      "오늘도 읽어주셔서 감사합니다!",
    ],
  },
  links: Object.values(sources),
} as const;
