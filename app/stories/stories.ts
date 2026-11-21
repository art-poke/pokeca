import research from "@/docs/research/pikachu-with-grey-felt-hat.json";

import { meleeStory } from "./melee-pokemon-scramble";

const { sources, usdToKrw } = research;
export { usdToKrw };
const wonFormat = new Intl.NumberFormat("ko-KR");

function inWon(dollars: number) {
  const rounded = Math.round(dollars * usdToKrw / 1000) * 1000;
  return `약 ${wonFormat.format(rounded)}원`;
}

const vanGoghStory = {
  id: "98869a9b-6dae-47c1-9722-cad75a7be315",
  slug: "pikachu-with-grey-felt-hat",
  shareImage: { url: "/specs/stories/og-pikachu-with-grey-felt-hat.jpg", width: 1200, height: 630, alt: "반 고흐의 자화상과 회색 펠트 모자를 쓴 피카츄 카드" },
  category: "promo",
  title: "피카츄는 왜 반 고흐의 모자를 썼을까?",
  summary: "미술관에서 숙제하면 주던 피카츄가 경매장에선 2억 원을 넘겼다고요? 일단 모자부터 보세요. 이 녀석, 그림에도 가격표에도 사연이 한가득입니다.",
  card: "Pikachu with Grey Felt Hat · SVP EN 085",
  author: "뮤츠조아요",
  researchedOn: research.researchedOn,
  intro: [
    "안녕하세요 뮤츠조아요입니다. 오늘은 포켓몬 카드를 좋아하신다면 한 번쯤은 들어봤을 고흐츄에 대해서 낋여와봤습니다.",
    "이름만 보면 피카츄한테 모자 하나 씌운 카드인데요. 출발지가 카드샵도, 대회장도 아닌 암스테르담의 미술관입니다. 처음엔 그림 찾기 활동지를 풀고 받던 카드가, 제가 확인한 2026년 eBay 경매에선 입찰 60건을 찍었어요. 대체 모자에 무슨 일이 있었던 건지, 그림부터 가격표까지 하나씩 볼게요.",
    "암스테르담이 어디냐면요, 유럽의 네덜란드 수도예요. 아래는 도심의 케이저르스흐라흐트 운하인데, 물길 양옆으로 좁고 높은 집들이 줄 서 있는 게 딱 암스테르담 풍경이에요. 이 도시에 있는 반 고흐 미술관에서 고흐츄 이야기가 시작됩니다.",
  ],
  introImage: {
    src: "/specs/stories/amsterdam-keizersgracht.webp",
    width: 1100,
    height: 734,
    alt: "네덜란드 암스테르담 케이저르스흐라흐트 운하와 물가에 늘어선 집들",
    credit: "암스테르담 케이저르스흐라흐트 운하. Jorge Franganillo 촬영, Wikimedia Commons. 크기 조정 및 WebP 변환.",
    attribution: {
      source: "https://commons.wikimedia.org/wiki/File:Amsterdam_-_Keizersgracht.jpg",
      license: "https://creativecommons.org/licenses/by/4.0/",
      label: "CC BY 4.0",
    },
  },
  image: {
    src: "/specs/stories/grey-felt-hat-card.webp",
    width: 245,
    height: 342,
    alt: "노란 테두리 안에 회색 펠트 모자를 쓴 피카츄가 그려진 SVP EN 085 카드",
    credit: "Pikachu with Grey Felt Hat · SVP EN 085. © The Pokémon Company International.",
  },
  portrait: {
    src: "/specs/stories/van-gogh-self-portrait.webp",
    width: 640,
    height: 777,
    alt: "파란 붓질의 배경 앞에서 회색 펠트 모자를 쓴 반 고흐의 자화상",
    credit: "빈센트 반 고흐, 〈회색 펠트 모자를 쓴 자화상〉, 1887. 반 고흐 미술관, 암스테르담(빈센트 반 고흐 재단).",
  },
  sections: [
    {
      title: "모자보다 먼저 배경을 봐주세요",
      body: [
        "정식 이름은 Pikachu with Grey Felt Hat. 영문 스칼렛·바이올렛 블랙 스타 프로모 085번이에요. 카드 이름이 길어서 그렇지, 우리끼린 고흐츄 세 글자면 다 통하죠. 이름 옆에 붙은 SVP EN 085는 뒤에서 거래 기록을 볼 때도 중요한 번호입니다. ‘Van Gogh Pikachu’로만 검색하면 그림이 비슷한 물건이 함께 뜰 수 있거든요.",
        "원본은 반 고흐가 1887년에 그린 〈회색 펠트 모자를 쓴 자화상〉입니다. 카드랑 나란히 놓고 보면 처음엔 모자 챙이 눈에 들어오는데, 두 번째에는 파란 배경이 보입니다. 사람 얼굴 주위를 감싸던 짧은 붓질이 피카츄 뒤에서도 빙글빙글 돌아요. 피카츄의 빨간 볼이나 노란 몸은 익숙한데, 주변이 워낙 반 고흐 그림 같아서 순간 미술관 기념 엽서를 보고 있는 느낌도 들어요.",
        "그리고 모자를 씌운 사람이 따로 있죠. 미술관 소개를 보니 피카츄를 그린 건 기무라 나오요(Naoyo Kimura)였어요. 고흐가 일본 판화를 보고 그림을 배웠는데, 100년이 훌쩍 지나 일본의 일러스트레이터가 그 사람 그림에 피카츄를 들여보낸 거예요. 저는 이 얘기를 알고 나니까 카드가 한 번 더 예뻐 보이더라고요.",
      ],
      image: {
        src: "/specs/stories/kimura-pikachu.webp",
        width: 300,
        height: 550,
        alt: "반 고흐 미술관이 소개한 Naoyo Kimura의 회색 펠트 모자 피카츄 작품",
        credit: "반 고흐 미술관이 소개한 협업 작품 이미지. Naoyo Kimura / © The Pokémon Company International.",
      },
      note: "기무라 나오요는 포켓몬 카드 일러스트레이터예요. 이 전시에서 피카츄 말고도 고흐의 〈까마귀가 나는 밀밭〉을 바탕으로 돈크로우와 아머까오의 진화 계열을 그렸어요.",
      sources: [sources.museumArtwork, sources.museumCollaboration, sources.announcement, sources.kimuraWorks],
    },
    {
      title: "잠깐, 모자 벗은 고흐는 어떻게 생겼을까요?",
      body: [
        "검색창에 반 고흐를 치면 수염 난 자화상이 먼저 나오잖아요. 그런데 열아홉 살 사진을 보면 수염도 없고 머리는 단정하고, 눈빛은 또 제법 익숙해요. 위의 자화상과 번갈아 보니까 새삼 한 사람이 십 년 넘게 나이를 먹고 자기 얼굴을 그린 거구나 싶더라고요.",
      ],
      image: {
        src: "/specs/stories/van-gogh-age-19.webp",
        width: 560,
        height: 849,
        alt: "단정한 머리에 재킷을 입은 열아홉 살 빈센트 반 고흐의 흑백 초상 사진",
        credit: "1873년, 열아홉 살의 빈센트 반 고흐. Jacobus Marinus Wilhelmus de Louw 촬영. 반 고흐 미술관 소장, Wikimedia Commons.",
      },
      note: "빈센트 반 고흐(1853–1890)는 네덜란드 화가예요. 미술관은 한때 열세 살 빈센트로 알려졌던 다른 사진을 다시 조사해 동생 테오로 정정했어요. 여기 실은 열아홉 살 사진은 미술관이 빈센트로 확인한 사진입니다.",
      sources: [sources.vincentPhoto, sources.vincentIdentity],
    },
    {
      title: "원래는 미술관에서 숙제를 하면 주는 카드였습니다",
      body: [
        "2023년 9월 28일, 암스테르담의 반 고흐 미술관이 개관 50주년을 맞아 포켓몬과 협업 전시를 열었습니다. 피카츄 혼자 미술관에 간 건 아니었어요. 포켓몬 작가들이 반 고흐 작품에서 영감을 받아 여섯 점을 만들었는데, 해바라기 그림에는 해너츠가 들어갔고 〈반 고흐의 방〉을 떠올리게 하는 그림에는 잠만보와 먹고자가 자리를 차지했습니다. 방 그림에 잠만보라니, 이건 배역 선정부터 이미 성공입니다.",
        "저는 ‘미술관 숙제’라는 말 듣고 종이 한 장에 문제 몇 줄 찍혀 있는 걸 상상했거든요. 당시 방문자가 찍은 아래 사진을 보세요. 종이 한쪽에 피카츄가 길잡이처럼 서 있고, 포켓몬 그림을 보기 전에 고흐의 자화상 뒷면에 무엇이 있는지 찾아보라는 문제도 있어요. 이런 식으로 전시장을 돌아다니며 답을 채워 내면, 재고가 있는 동안 고흐츄를 받았죠.",
        "입장권을 끊고 그림을 찾아다니는 코스였으니, 저라면 카드 받고 나서도 활동지까지 챙겨왔을 것 같아요. 그리고 집에서 주문한 분들도 있었어요. 포켓몬센터는 온라인 협업 상품에 같은 카드를 사은품으로 붙였거든요.",
      ],
      image: {
        src: "/specs/stories/pokemon-adventure-leaflet.webp",
        width: 900,
        height: 540,
        alt: "2023년 반 고흐 미술관에서 배포한 Pokémon Adventure 활동지를 전시장 안에서 들어 보인 사진",
        credit: "실제 Pokémon Adventure 활동지. Matt Poskitt 촬영, The Guardian.",
      },
      additionalImage: {
        src: "/specs/stories/van-gogh-pokemon-exhibition.webp",
        width: 693,
        height: 451,
        alt: "노란 벽에 포켓몬과 반 고흐 협업 그림이 걸린 전시장에 서 있는 피카츄 마스코트",
        credit: "2023년 포켓몬 협업 전시 현장. 반 고흐 미술관 2023년 연차보고서 수록 사진.",
      },
      sources: [sources.leaflet, sources.announcement, sources.annualReport],
    },
    {
      title: "그런데 미술관 배포는 한 달도 못 갔습니다",
      body: [
        "행사가 9월 28일에 시작했는데, 10월 14일에 미술관 카드 지급이 멈췄어요. 보름 남짓이에요. 미술관 연차보고서에는 카드를 받아 바로 되팔려는 방문객이 있었고, 일부 인원이 안전 문제를 일으켜 지급을 중단했다고 적혀 있습니다. 그림을 보러 온 사람도, 카드를 기다린 아이들도 꽤 당황했겠죠.",
        "그러고 보니 ‘10월에 끝났다’는 말도 조금 헷갈리더라고요. 10월에 멈춘 건 미술관에서 카드를 나눠주는 일이었고, 협업 전시는 이듬해 1월 7일까지로 안내됐어요.",
        "그리고 2024년 2월 10일, 이번엔 미술관 대신 네덜란드의 참여 매장에 고흐츄가 나타납니다. 카드 상품을 한 번에 29.99유로(글 작성 기준 약 44,000원) 이상 사면, 재고가 있는 동안 한 장을 사은품으로 주는 행사였어요. 29.99유로는 장바구니에 담아야 하는 금액이고요. 어쩌다 보니 이 피카츄를 만나는 방법이 미술관 숙제에서 카드팩 쇼핑으로 바뀌었습니다.",
      ],
      image: {
        src: "/specs/stories/museum-counter-illustration.webp",
        width: 900,
        height: 600,
        alt: "회색 모자를 쓴 파란 비둘기가 미술관의 텅 빈 배포 창구를 바라보는 삽화",
      },
      sources: [sources.annualReport, sources.retail, sources.exchangeRate],
    },
    {
      title: "그럼 지금 고흐츄 한 장은 얼마인데요?",
      body: [
        `가격을 보다가 제가 제일 먼저 한 건 카드 번호 다시 확인하기였어요. 둘 다 085번에 PSA 10인데 숫자가 너무 달랐거든요. 2024년 6월 Pristine 경매는 입찰 14건에 237.14달러(${inWon(237.14)}). 구매자 수수료를 넣으면 총 277.45달러(${inWon(277.45)})였어요.`,
        `그런데 2026년 10월 12일 eBay 경매는 입찰 60건에 2,475달러(${inWon(2475)})였습니다. 배송비 25달러(${inWon(25)})가 따로 표시됐고요. 32만 원쯤 하던 경매 기록을 보고 바로 옆에 331만 원짜리 기록을 띄워놓으니, 저라면 피카츄도 잠깐 모자를 벗고 숫자를 다시 셀 것 같아요.`,
        `11월에도 비슷한 높이의 경매가 있었습니다. PSA의 동급 카드 거래 기록에는 11월 9일 eBay 경매 2,425달러(${inWon(2425)})가 올라와 있었어요. 같은 날짜에 고정가 2,452.98달러(${inWon(2452.98)}), 가격 제안 거래 2,223.63달러(${inWon(2223.63)})도 따로 잡혀 있습니다. ‘eBay에서 팔렸다’는 말만 들으면 전부 낙찰가처럼 느껴지는데, 결과를 뜯어보면 경매와 즉시구매, 판매자가 수락한 가격 제안이 섞여 있어요.`,
        "아래에는 제가 확인한 경매 세 건만 막대로 뽑아봤어요. 이렇게 붙여 보면 차이가 확 오는데, 사이사이 거래까지 전부 보여주는 그래프는 아니에요. 요즘 평균적으로 얼마에 팔리는지 궁금하시면 바로 다음 단락에 거래 여러 건을 모아 놓은 숫자도 있습니다.",
      ],
      note: "거래 기록은 2026년 11월 21일에 확인했어요. 원화는 비교하기 편하게 11월 20일 오후 3시 30분 환율(1달러당 1,336.20원)로 통일해 천 원 단위로 반올림했습니다. 당시 환율과 결제 수수료에 따라 실제 결제액은 달라요.",
      sources: [sources.pristine, sources.ebay, sources.psa, sources.exchangeRate],
    },
  ],
  sales: [
    { date: "2024.06.19", grade: "PSA 10", venue: "Pristine 경매", amount: 237.14, won: inWon(237.14), note: `구매자 수수료 포함 $277.45 (${inWon(277.45)})`, source: sources.pristine },
    { date: "2026.10.12", grade: "PSA 10", venue: "eBay 경매", amount: 2475, won: inWon(2475), note: `입찰 60건 · 배송비 $25 (${inWon(25)}) 별도`, source: sources.ebay },
    { date: "2026.11.09", grade: "PSA 10", venue: "eBay 경매", amount: 2425, won: inWon(2425), note: "PSA 동급 거래 기록 기준", source: sources.psa },
  ],
  auctionReaction: {
    src: "/specs/stories/pikachu-surprised.webp",
    width: 560,
    height: 324,
    alt: "눈을 동그랗게 뜨고 입을 벌린 피카츄의 애니메이션 장면",
    credit: "가격표 본 제 표정. 포켓몬 애니메이션 1기 10화 장면, Know Your Meme.",
  },
  marketComparisons: [
    {
      title: "등급 한 칸 차이, 약 2.9배",
      context: "미국 eBay 최근 14일 거래 중앙값 · 2026.11.19 갱신",
      values: [
        { label: "PSA 9 · 46건", amount: 836, won: inWon(836) },
        { label: "PSA 10 · 64건", amount: 2427, won: inWon(2427) },
      ],
    },
    {
      title: "PSA 10, 봄에서 가을까지",
      context: "미국 eBay 월별 거래 중앙값 · 두 달 비교",
      values: [
        { label: "2026년 5월", amount: 2922, won: inWon(2922) },
        { label: "2026년 10월", amount: 2502, won: inWon(2502) },
      ],
    },
  ],
  rawMarket: { amount: 947.45, won: inWon(947.45), source: sources.tcgmetric },
  blackLabel: {
    amount: 150000,
    won: inWon(150000),
    source: sources.fanaticsBlackLabel,
    image: {
      src: "/specs/stories/grey-felt-hat-bgs-black-label.webp",
      width: 480,
      height: 753,
      alt: "Fanatics Collect에서 판매된 BGS 10 블랙라벨 고흐츄 카드와 인증 케이스",
      credit: "Fanatics Collect 경매 로트 7 · 인증번호 0018572662",
    },
    story: {
      title: "잠깐, 고흐츄 한 장에 2억 원이요?",
      body: [
        "PSA 10 가격 보고 놀라셨다면 잠깐만요. Fanatics Collect 경매 결과에서 블랙라벨 고흐츄 한 장이 2억 원을 넘겼어요. 저도 일단 0이 몇 개인지부터 다시 봤습니다. 위에서 본 카드와 같은 085번인데, 이번엔 카드 위쪽의 까만 감정 라벨부터 봐야 해요.",
        "Beckett은 카드의 센터링, 모서리, 가장자리, 표면을 따로 봐요. 골드라벨 Pristine 10과 블랙라벨 Perfect Pristine 10도 구분합니다. 거래 제목에 ‘BGS 10’이 보이면 숫자만 보지 말고 라벨까지 확인해야 하는 이유예요.",
        `같은 경매사의 2025년 7월 기록에는 ‘BGS 10’으로 표기된 별도 매물이 구매자 수수료 포함 3,960달러(${inWon(3960)})에 팔렸어요. 두 건은 라벨 표기와 판매 시점이 달라서 차이 전부를 라벨 값이라고 보긴 어려워요. 2억 원짜리는 2026년 10월에 실제로 나온 블랙라벨 사례 한 건으로 기억해두면 됩니다.`,
      ],
      sources: [sources.fanaticsBlackLabel, sources.beckett, sources.fanaticsBgs10],
    },
  },
  closingSections: [
    {
      title: "한 건 말고 여러 건을 보면 좀 다른 얘기가 나옵니다",
      body: [
        "저는 처음에 이 카드가 내내 올라갔겠거니 했는데, 2026년 5월과 10월을 나란히 놓으니 오히려 가을 쪽 막대가 짧더라고요. 반대로 같은 기간에 등급만 바꿔 보면 PSA 10과 9 사이 간격이 훨씬 큽니다. 위에서 본 개별 낙찰처럼 한 장의 사연에 끌리더라도, 가격 감을 잡을 땐 같은 등급 거래를 여러 건 모아 보는 편이 훨씬 쉽겠어요.",
        "미감정은 별도 장터의 시장 지표라 옆 차트에 섞지 않았어요. 같은 미감정 카드라도 봉투가 남아 있는지, 모서리가 어떤지에 따라 가격이 달라져서, 숫자 하나만 보고 비교하긴 어렵더라고요.",
      ],
      sources: [sources.sniper, sources.tcgmetric],
    },
    {
      title: "저라면 가격표를 닫고 그림을 한 번 더 볼 것 같아요",
      body: [
        "저한테 이 카드의 하이라이트는 여전히 저 회색 모자보다 휘감기는 파란 배경입니다. 똑같은 자화상을 먼저 보고 카드를 보면, 조금 전까지 그냥 귀여운 피카츄였던 게 갑자기 ‘그 그림을 어떻게 바꿨는지’ 보이는 카드가 돼요. 거기에 미술관 활동지, 현장 배포 중단, 네덜란드 매장 재등장까지 붙으니까 카드 한 장으로 얘깃거리가 한참 나옵니다.",
        "가격표 보고 식겁하셨다면 위로 조금 올라가서 카드랑 자화상을 한 번 더 번갈아 보세요. 공짜로 바로 즐길 수 있는 부분이 꽤 많습니다. 저는 오늘도 장바구니는 조용히 닫고 회색 모자나 좀 더 보겠습니다. 뮤츠조아요였습니다!",
      ],
      sources: [],
    },
  ],
  links: [
    { label: "포켓몬 공식 카드 이미지 보기", href: sources.retail.href },
    { label: "반 고흐의 원본 그림 보기", href: sources.museumArtwork.href },
  ],
} as const;

export const stories = [vanGoghStory, meleeStory] as const;
