import research from "@/docs/research/poncho-pikachu.json";

const { sources, comparisons, fx, pop10, release, sales231 } = research;
const money = new Intl.NumberFormat("ko-KR");
const assets = "/specs/stories/poncho";

function won(amount: number, currency: "USD" | "JPY") {
  return amount * fx[currency];
}

function price(krw: number) {
  return `약 ${money.format(Math.round(krw / 1000) * 1000)}원`;
}

function card(set: "xy" | "sm", number: number, name: string) {
  const label = `${String(number).padStart(3, "0")}/${set === "xy" ? "XY-P" : "SM-P"}`;
  return {
    name, label, src: `${assets}/${set}-${number}.webp`,
    width: set === "xy" ? 500 : 590,
    height: set === "xy" ? 698 : 823,
    alt: `일본판 ${name} 피카츄 ${label} 카드 앞면`,
  };
}

function photo(file: string, width: number, height: number, alt: string) {
  return { src: `${assets}/${file}.webp`, width, height, alt };
}

function contentsPhoto(file: string, width: number, height: number, caption: string, alt: string, fullWidth = false) {
  return { ...photo(file, width, height, alt), caption, fullWidth };
}

const charizardX = card("xy", 207, "메가리자몽 X");
const shinyRayquaza = card("xy", 231, "검정 메가레쿠쟈");
const skytreeBox = photo("rayquaza", 730, 429, "초록과 검정 레쿠쟈 판초 피카츄가 그려진 일본 스카이트리타운 개점 기념 박스");
const [historical, october, , japan, november] = sales231;

export const ponchoStory = {
  id: "d3a2325f-6896-4a30-9baf-b4c5a7ddb2cb",
  slug: "poncho-pikachu",
  category: "promo",
  title: "피카츄야, 그거 가죽 아니지? 판초 피카츄가 2천만 원이 된 사연",
  summary: "레쿠쟈한테 잡아먹힌 줄 알았는데 피카츄가 입은 옷이래요. 어떤 박스에 무슨 옷이 들었는지, PSA 10이 2천 장 넘는데도 왜 가격표 앞에서 멈칫하게 되는지 따라가 봤습니다.",
  author: "뮤츠조아요",
  card: "일본 포켓몬센터 프로모 · XY-P / SM-P",
  researchedOn: research.checkedOn,
  image: shinyRayquaza,
  shareImage: {
    url: "/specs/stories/og-poncho-pikachu.jpg", width: 1200, height: 630,
    alt: "검정 메가레쿠쟈와 메가리자몽 X 판초를 입은 일본판 피카츄 카드",
  },
  intro: [
    "안녕하세요 뮤츠조아요입니다. 오늘은 피카츄가 포켓몬 가죽을 뒤집어쓴 줄 알고 잠깐 멈칫했던, 판초 피카츄 이야기 낋여와봤습니다.",
    "판초가 뭐냐면요. 가운데에 머리를 넣는 구멍이 있고, 위에서 쑥 뒤집어쓰면 천이 어깨랑 몸을 덮는 옷이에요. 망토처럼 아래가 헐렁하게 퍼지는 우비를 떠올리면 쉬워요. 피카츄가 입은 판초에는 후드가 달렸는데, 그 후드를 포켓몬 머리 모양으로 만든 거죠.",
    "검정 레쿠쟈 카드부터 한번 보세요. 후드에 턱이랑 이빨까지 그려져 있으니까, 저는 처음에 피카츄가 레쿠쟈 입에서 고개를 내민 줄 알았어요. ‘포켓몬끼리 이래도 되나~’ 싶었는데, 공식 안내를 보니 저 친구가 입은 건 레쿠쟈 모양 판초였습니다. 남의 얼굴을 빌려 쓰고도 볼따구만큼은 너무 피카츄죠.",
    "그런데 이거 한 장만 보려고 검색했다가 더 헷갈렸어요. 카드 이름은 다 비슷한데 뒤에 붙은 번호도, 나오는 박스도 달라요. 그러다 검정 레쿠쟈 가격을 눌렀는데 2천만 원을 넘긴 기록에 PSA 10이 2천 장 넘게 잡혀 있더라고요. 저만 ‘잠깐, 그렇게 많은데?’ 하고 생각한 거 아니죠?",
  ],
  sections: [
    {
      title: "첫 장은 도쿄 매장이 이사하면서 나왔어요",
      body: [
        "2014년 12월 12일, 일본 도쿄의 포켓몬센터가 하마마쓰초에서 이케부쿠로로 옮기면서 ‘메가도쿄’라는 이름을 달았어요. 새 매장은 이케부쿠로 선샤인시티 쇼핑몰 2층에 들어섰습니다. 당시 매장을 설계한 탄세이샤의 사진을 보니 입구 한가운데 커다란 몬스터볼부터 눈에 들어오더라고요.",
      ],
      image: photo("megatokyo-opening", 1000, 667, "이케부쿠로 선샤인시티 포켓몬센터 메가도쿄의 개점 당시 매장 입구. 중앙에 커다란 몬스터볼이 보인다."),
      afterImage: [
        "그 입구로 들어가 물건을 산 손님에게 준 카드가 098/XY-P예요. 피카츄가 벌써 메가리자몽 Y 모양 옷을 입고 있습니다. 가운데 주인공처럼 서 있고 뒤에는 별까지 터져요. 옷 한 벌 입고 너무 당당한 거 아닌가요?",
        "옆의 204/XY-P도 인쇄된 이름은 똑같이 ‘메가도쿄의 피카츄’예요. 그런데 2016년 1월 이벤트 참가자에게 간 쪽이고, 그림에서는 여러 마리가 한꺼번에 뛰어다닙니다. 보통 ‘판초 피카츄’라고 한 바구니에 담아 부르니까, 막상 한 장을 찾을 땐 이름보다 아래쪽 번호가 먼저였어요.",
      ],
      cards: [card("xy", 98, "메가도쿄 개점 기념"), card("xy", 204, "메가도쿄 이벤트판")],
    },
    {
      title: "히로시마에선 입이 더 커집니다",
      body: [
        "2015년 6월 26일, 일본 히로시마의 포켓몬센터 개점을 기념해 잉어킹·갸라도스 박스가 나왔습니다. 이름에는 히로시마가 붙었지만 상품 안내의 판매처는 일본 포켓몬센터 전 매장이었어요. 빨간 박스를 열면 잉어킹 150과 갸라도스 151이 한 장씩, 확장팩 《밴디트링》 5팩이 나왔어요. 두 피카츄가 그려진 덱 케이스 1개, 슬리브 62장, 긴 카드 보관함 1개도 들어 있었고요.",
        "둘을 같이 놓으면 왜 한 쌍으로 기억되는지 알겠어요. 잉어킹 쪽은 저 얼굴 옆에 자그마한 수염까지 달았고, 갸라도스는 이빨을 한껏 드러냈는데 정작 안쪽 피카츄는 너무 순합니다. 카드에 적힌 이름에는 일본어로 ‘흉내 내기’라는 말이 붙었어요. 둘 다 가죽인 줄 알았던 제 눈에는 오히려 그게 제일 친절한 설명이더라고요.",
      ],
      image: photo("hiroshima", 730, 740, "2015년 잉어킹·갸라도스 피카츄 스페셜 박스와 공식 구성품"),
      contents: [
        contentsPhoto("hiroshima-contents", 730, 1173, "잉어킹·갸라도스 박스 구성품", "밴디트링 확장팩과 프로모 두 장, 양면 덱 케이스, 슬리브, 긴 보관함이 나온 공식 구성품 이미지", true),
      ],
      cards: [card("xy", 150, "잉어킹 흉내"), card("xy", 151, "갸라도스 흉내")],
    },
    {
      title: "리자몽 X랑 Y를 둘 다 갖고 싶으면요?",
      body: [
        `여기서 박스 고르기가 시작됩니다. 2016년 새해 첫날 나온 메가리자몽 X·Y 박스는 겉 색을 고르는 순간 같이 따라오는 카드도 달라졌어요. 푸른 X 박스에는 207, 주황 Y 박스에는 208. 당대 두 박스 정가를 지금 환율로 바꿔 보면 각각 세전 ${price(won(release.charizard.JPYBeforeTaxEach, "JPY"))}이었어요. 두 판초가 다 눈에 들어왔다면 박스도 두 개였던 셈이죠.`,
        "둘 다 따라오는 카드가 하나 더 있었어요. 후드 없이 앞으로 뛰어오는 206/XY-P 피카츄입니다. 한 박스에서 카드 두 장이 나온다는 말만 듣고 리자몽 X와 Y가 둘 다 들어 있는 줄 알았는데, 박스 공지에선 각 버전 판초 한 장과 공통 피카츄 한 장이었어요. 중고로 볼 때도 206인지, 207인지, 208인지 보는 이유가 여기 있습니다.",
      ],
      image: photo("charizard", 730, 632, "공식 상품 안내의 메가리자몽 X 푸른 박스와 Y 주황 박스"),
      afterImage: [
        "자, 박스 뚜껑을 한번 열어볼까요? X든 Y든 반짝이는 프로모 카드가 2장, 확장팩이 5팩 들어 있었어요. 팩은 《파천의 분노》 2팩에 《라이징피스트》, 《팬텀게이트》, 《에메랄드브레이크》가 1팩씩. 팩 속 카드는 랜덤이라 이쪽에도 뜯어 보는 재미가 있었겠죠.",
        "용품은 덱 케이스 1개, 슬리브 62장, 카드가 최대 750장 들어가는 긴 보관함 1개예요. 덱 케이스랑 슬리브에도 각각 X랑 Y 판초를 입은 피카츄가 그려져 있어서, 어느 박스를 고르느냐에 따라 카드랑 덱 꾸미는 맛이 같이 달라졌어요.",
      ],
      contents: [
        contentsPhoto("charizard-packs", 730, 405, "X·Y 공통 확장팩 5팩", "파천의 분노 2팩과 라이징피스트, 팬텀게이트, 에메랄드브레이크 패키지가 보이는 공식 제품 이미지", true),
        contentsPhoto("charizard-x-case", 730, 250, "X 박스 · 덱 케이스", "푸른 메가리자몽 X 판초 피카츄가 그려진 덱 케이스"),
        contentsPhoto("charizard-y-case", 730, 250, "Y 박스 · 덱 케이스", "주황 메가리자몽 Y 판초 피카츄가 그려진 덱 케이스"),
        contentsPhoto("charizard-x-sleeves", 730, 265, "X 박스 · 슬리브", "메가리자몽 X 판초 피카츄가 그려진 푸른 슬리브"),
        contentsPhoto("charizard-y-sleeves", 730, 264, "Y 박스 · 슬리브", "메가리자몽 Y 판초 피카츄가 그려진 주황 슬리브"),
        contentsPhoto("charizard-x-storage", 730, 370, "X 박스 · 긴 카드 보관함", "짙은 바탕에 여러 메가진화 판초 피카츄가 그려진 긴 카드 보관함"),
        contentsPhoto("charizard-y-storage", 730, 374, "Y 박스 · 긴 카드 보관함", "흰 바탕에 여러 메가진화 판초 피카츄가 그려진 긴 카드 보관함"),
      ],
      cards: [charizardX, card("xy", 208, "메가리자몽 Y"), card("xy", 206, "두 박스 공통 동봉")],
    },
    {
      title: "레쿠쟈는 왜 한 박스에 두 마리냐면요",
      body: [
        "반년쯤 뒤인 2016년 7월 6일, 일본 도쿄 스카이트리 아래 상업시설인 소라마치에 새 포켓몬센터가 열렸어요. 그 개점을 기념한 레쿠쟈 박스는 리자몽 때랑 구성이 달랐습니다. 초록 230과 색이 다른 검정 231이, 똑같이 한 장씩 한 박스 안에 들어 있었어요.",
        "공식 상품 사진에서 박스 옆면까지 한번 보세요. 여러 포즈로 돌아다니는 조그만 피카츄들이 잔뜩 그려져 있습니다. 저라면 카드를 꺼내고 나서도 박스는 못 버렸을 것 같아요. 세트로 구경할 땐 옷 색만 바꿔 보고, 시세를 볼 땐 230이랑 231을 따로 검색하는 게 편합니다.",
      ],
      image: skytreeBox,
      additionalImage: photo("skytreetown-shop", 850, 478, "포켓몬센터 공식 사이트의 도쿄 스카이트리타운 매장 모습"),
      afterImage: [
        "박스 안에는 두 판초 카드 외에 《폭열의 투사》와 《냉혹의 반역자》가 2팩씩, 레쿠쟈 판초가 그려진 덱 케이스 1개와 슬리브 62장, 긴 카드 보관함 1개가 들어 있었어요.",
      ],
      note: "공식 페이지의 구성품 이미지에는 《에메랄드브레이크》 1팩이 더 나오고, 아래 상품 정보 표에는 그 팩이 빠져 있어요. 두 곳에 공통으로 적힌 팩부터 본문에 적었습니다.",
      contents: [
        contentsPhoto("rayquaza-packs", 730, 411, "레쿠쟈 박스 · 공식 홍보 이미지의 확장팩", "폭열의 투사, 냉혹의 반역자, 에메랄드브레이크 포장이 보이는 공식 제품 이미지", true),
        contentsPhoto("rayquaza-case", 730, 270, "레쿠쟈 박스 · 덱 케이스", "초록과 검정 레쿠쟈 판초 피카츄가 그려진 덱 케이스"),
        contentsPhoto("rayquaza-sleeves", 730, 250, "레쿠쟈 박스 · 슬리브", "레쿠쟈 판초 피카츄가 그려진 슬리브"),
        contentsPhoto("rayquaza-storage", 730, 375, "레쿠쟈 박스 · 긴 카드 보관함", "초록색 무늬에 여러 포즈의 판초 피카츄가 그려진 긴 카드 보관함", true),
      ],
      cards: [card("xy", 230, "초록 메가레쿠쟈"), shinyRayquaza],
    },
    {
      title: "박스를 열어도 단체 사진은 안 나옵니다",
      body: [
        `판초가 여러 벌 찍힌 카드도 있는데요. 203은 2015년 12월 포켓몬센터 메가 캠페인에서 포켓몬 카드 상품을 지금 환율로 ${price(won(release.megaPurchase203.eligiblePurchaseJPY, "JPY"))}어치 살 때마다 한 장씩 줬어요. 274와 275는 이듬해 여름 포켓몬센터 메가 배틀에서 플레이 포인트 3점을 모아 받을 수 있었던 카드들이고요. 같은 이름을 쓰는데 이쪽은 이야기의 시작부터 구매 사은품과 행사 보상으로 갈립니다.`,
        "아래 셋을 모아 놓으니 제 눈엔 피카츄들 체육대회 단체 사진 같아요.",
      ],
      cards: [card("xy", 203, "메가 캠페인 구매 증정"), card("xy", 274, "메가 배틀 보상"), card("xy", 275, "메가 배틀 보상")],
    },
    {
      title: "식스테일 두 마리는 한 박스에",
      body: [
        "그러다 2017년 2월 1일에는 알로라 식스테일 037이랑 일반 식스테일 038이 한 스페셜 박스에 한 장씩 들어갑니다. 여긴 《컬렉션 선》과 《컬렉션 문》이 1팩씩, 덱 케이스 1개와 슬리브 64장, 카드 보관함 1개가 따라왔어요. 복슬복슬한 후드까지 오면 가죽이냐고 의심하던 저도 그냥 잠옷이라고 부르게 됐어요. 여기까지가 이 글에서 펼쳐본 판초와 그 앞뒤의 일본판 카드들이에요.",
      ],
      contents: [
        contentsPhoto("vulpix-contents", 525, 700, "식스테일 박스 · 경매에 올라온 구성품 실물", "식스테일과 알로라 식스테일 판초 피카츄가 그려진 보관함, 덱 케이스, 슬리브와 프로모 카드", true),
      ],
      cards: [card("sm", 37, "알로라 식스테일"), card("sm", 38, "식스테일")],
    },
  ],
  market: {
    title: "PSA 10이 2천 장 넘는데, 한 장에 2천만 원이요?",
    body: [
      `가격표는 제가 처음 멈춰 섰던 검정 레쿠쟈 231부터 봤어요. Fanatics Collect에 남은 2025년 12월 15일 PSA 10 판매 기록은 ${price(won(historical.amount, "USD"))}. 이때도 한 장 사려면 이미 천만 원을 넘겨야 했네요. 다음 해로 넘어가니까 숫자가 또 달라집니다.`,
      `PSA 거래 기록에 따르면 10월 12일 eBay 경매에선 ${price(won(october.amount, "USD"))}, 11월 17일엔 ${price(won(november.amount, "USD"))}이었습니다. 재미있는 건 두 기록의 감정 인증번호가 둘 다 63199190이라는 점이에요. 겉에 적힌 번호까지 같은데 한 달 사이에 표시된 금액이 꽤 달랐어요. 판매가 다시 올라온 이유나 결제 경위까지는 공개 기록에서 알 수 없고요.`,
      `일본 SNKRDUNK도 열어봤습니다. 11월 9일에 검정 레쿠쟈 PSA 10 한 장이 ${price(won(japan.amount, "JPY"))}에 거래됐어요. 같은 날 Fanatics Collect 경매는 30번 입찰에 구매자 수수료 포함 ${price(won(comparisons.fanatics231Psa10.USD, "USD"))}. 여기까지 보고 나서 처음 가격표를 다시 보니, 서로 다른 장터에서도 2천만 원 넘는 사례가 보이더라고요. 확인한 거래 중 몇 건을 골라 오래된 순으로 펼쳐봤어요.`,
    ],
    note: "원화는 2026년 11월 20일 오후 3시 30분 기준 환율로 환산하고 천 원 단위로 반올림했어요. 날짜와 수수료는 출처 표기를 따랐고, 배송비와 미표기 비용은 더하지 않았습니다.",
  },
  sales: sales231.map((sale) => {
    const krw = won(sale.amount, sale.currency === "JPY" ? "JPY" : "USD");
    return { ...sale, krw, won: price(krw), source: sources[sale.source as keyof typeof sources] };
  }),
  population: pop10.map((row) => ({
    count: row.count,
    image: card("xy", Number(row.card), row.name),
    source: sources[row.source as keyof typeof sources],
  })),
  closing: [
    {
      title: "여기서 ‘2,207장’이 세는 것",
      body: [
        `조사하면서 PSA 10 숫자를 다시 봤어요. 검정 레쿠쟈 231은 2,207장, 초록 레쿠쟈 230은 2,366장으로 표시됩니다. 메가리자몽 X 207은 2,473장인데, 11월 15일 eBay 경매 한 건이 ${price(won(comparisons.ebay207Psa10.USD, "USD"))}이었어요. 적어도 제가 본 사례에선 ‘POP이 더 적은 카드가 꼭 더 비싸다’는 식으로 가격표를 읽을 수 없었습니다.`,
        "POP이 세는 건 PSA가 해당 등급에 등록한 카드 수예요. 그중 오늘 매물로 나온 게 몇 장인지, 지금 그 옷을 꼭 갖고 싶어 하는 사람이 몇 명인지는 이 표에 없어요. 친구 바인더에서 본 카드까지 전부 오늘의 판매 물량이라고 생각하면 이상하잖아요. 박스 개점 기념이라는 기억, 리자몽 X·Y나 레쿠쟈 두 색을 한 쌍으로 두고 싶은 마음, 그 안에서도 상태 좋은 한 장을 고르려는 수요가 겹칠 법해요. 저한테는 그게 ‘2천 장 넘는데 왜?’에 대한 가장 납득되는 설명이었습니다. 가격에는 각각 얼마나 반영됐을지 궁금하지만, 공개 거래표에서 알 수 있는 건 팔린 날짜와 금액 정도예요.",
        `같은 옷을 입어도 라벨 한 줄에서 다시 갈립니다. SNKRDUNK에서 10월 11일 검정 레쿠쟈 PSA 9는 ${price(won(comparisons.snkr231Psa9.JPY, "JPY"))}에 거래됐고, 11월 9일 메가리자몽 Y PSA 10은 ${price(won(comparisons.snkr208Psa10.JPY, "JPY"))}였습니다. 서로 다른 날짜의 한 장씩이지만, ‘판초츄 얼마야?’에 답하려면 일단 무슨 판초에 몇 번 카드인지부터 물어야겠더라고요.`,
      ],
    },
    {
      title: "그래서 저는 무슨 옷을 고르냐면요",
      body: [
        "처음엔 검정 레쿠쟈 입 안쪽이 신경 쓰여서 확대했는데, 다시 전부 펼쳐놓고 보니 잉어킹에서 제일 오래 멈췄어요. 거창한 메가진화 후드도 좋은데, 잉어킹은 일단 입고 나왔다는 사실 자체가 웃기거든요. 옆에 갸라도스를 놓으니 그때 포켓몬센터가 왜 두 장을 한 박스에 같이 넣었는지도 조금 알 것 같고요.",
        "가격표를 덮어도 어느 옷이 제일 마음에 드는지는 남더라고요. 여러분 바인더에 딱 한 칸 남았다면, 검정 레쿠쟈인가요, 아니면 저처럼 잉어킹인가요? 뮤츠조아요였습니다!",
      ],
    },
  ],
  links: Object.values(sources),
} as const;
