import research from "@/docs/research/melee-pokemon-scramble.json";

const { sources, fx, release, snkrdunk, otherSales } = research;
const [pikachu, mewtwo, mew] = snkrdunk;
const format = new Intl.NumberFormat("ko-KR");

export function meleeKrw(amount: number, currency: "USD" | "JPY") {
  return amount * fx[currency];
}

export function meleePrice(amount: number, currency: "USD" | "JPY" = "JPY") {
  const won = Math.round(meleeKrw(amount, currency) / 1000) * 1000;
  return `약 ${format.format(won)}원`;
}

export const meleeStory = {
  id: "b77a7bcc-e79f-4d5f-b788-c221fc31d29f",
  slug: "melee-pokemon-scramble",
  shareImage: { url: "/specs/stories/og-melee-pokemon-scramble.jpg", width: 1200, height: 630, alt: "난전 포켓몬 스크램블의 각진 장난감 피카츄와 뮤츠 카드" },
  category: "promo",
  title: "카트라이더 닮은 피카츄가 4천만 원이라고요?",
  summary: "각진 뮤츠가 너무 귀여워서 한 장만 사려 했거든요. 2009년 Wii 장난감 포켓몬부터 16장 세트 바깥의 19번 이브이, 그리고 4천만 원 넘게 팔린 피카츄까지 낋여왔습니다.",
  card: "난전! 포켓몬 스크램블 × 포켓몬 카드 게임 · 일본판 Pt-R",
  author: "뮤츠조아요",
  researchedOn: research.researchedOn,
  intro: [
    "안녕하세요 뮤츠조아요입니다. 오늘은 제가 장바구니에 담으려다 가격표 보고 손을 슬쩍 뗀, 난전! 포켓몬 스크램블 카드 낋여와봤습니다.",
    "처음 이 피카츄를 봤을 때 카트라이더부터 생각났어요. 머리는 큼직하고, 팔다리는 짧고, 귀에는 접힌 자국이 보일 것처럼 각이 져 있거든요. 분명 입체인데 옆으로 돌리면 종이 한 장쯤 나올 것 같고요. 뮤츠는 더 웃깁니다. 세상 진지한 포켓몬이 저 쪼그만 발로 서 있으니까 괜히 한 장 데려오고 싶은 거예요.",
    "그래서 피카츄 가격부터 눌러봤죠. 일본에서 한 장에 4천만 원 넘게 팔린 기록이 있더라고요. 잠깐만요, 이거 16장 세트 가격인가? 싶어서 수량부터 다시 봤어요. 네, 한 장이었습니다. 일단 그림부터 같이 봐요.",
  ],
  image: {
    src: "/specs/stories/melee-pikachu.webp", width: 493, height: 680,
    alt: "2009년 일본판 난전 포켓몬 스크램블 피카츄 007/016 카드. 각진 귀와 둥근 몸을 가진 장난감 피카츄",
  },
  sections: [
    {
      title: "저 각진 얼굴, Wii 안에서 진짜 뛰어다닙니다",
      body: [
        "2009년 6월 16일, 일본 WiiWare에 《난전! 포켓몬 스크램블》이 나왔어요. 영어 이름은 Pokémon Rumble. 제목의 Melee는 일본어 ‘난전’을 옮긴 말이라 일본판 카드 거래 제목에 자주 보입니다. 검색창에서 Pokémon Rumble도 같이 나오니, 카드 보러 갈 땐 아래쪽 로고와 언어를 먼저 보면 편해요.",
        "주인공은 신기한 나사로 움직이는 포켓몬 장난감이에요. 저 각진 피카츄들이 우르르 몰려 나와서 마지막 한 마리가 남을 때까지 기술을 쏩니다. 스크린샷을 보니 카드만 보고 귀엽다고 했던 애들이 게임에선 제법 살벌하게 싸우더라고요. 둥글둥글한 피카츄도 좋아하지만, 저는 조립 설명서에 들어 있을 것처럼 생긴 이쪽에 한 표입니다.",
      ],
      image: { src: "/specs/stories/melee-game.webp", width: 321, height: 179, alt: "포켓몬 공식 사이트에 공개된 2009년 WiiWare 난전 포켓몬 스크램블 게임 화면" },
      sources: [sources.game, sources.checklist],
    },
    {
      title: "4천 원쯤이면 카드가 열여섯 장이었다고요",
      body: [
        `게임이 나온 지 한 달도 안 된 7월 10일, 일본 포켓몬센터에 카드 버전이 들어왔어요. 당시 정가를 지금 기준으로 환산해 보니 세전 ${meleePrice(release.jpyBeforeTax)}이었어요. 박스를 열면 카드 16장에 배틀 매트, 주사위, 플레이어 마커랑 데미지 카운터가 들어 있었습니다. 저라면 포켓몬센터 갔다가 ‘주사위까지 들어 있대’ 하고 가볍게 집었을 것 같아요.`,
        "룰도 꽤 난전입니다. 2~7명이 둘러앉아 누가 마지막까지 버틸지 먼저 찍고, 주사위로 쓸 기술과 맞을 상대를 정해요. 내 최애 골라놓고 신나게 주사위를 굴렸는데 그 주사위가 최애한테 기술을 날리는 쪽으로 굴러갈 수도 있는 거죠. 이 구성이 통째로 있었으니 당시에는 피카츄 007/016 한 장을 사는 게 아니라 친구들 불러서 한 판 하려고 사는 물건이었습니다.",
        "이 게임은 맥도날드에도 갔어요. 일본에서 닌텐도 DS를 들고 매장에 가면 하루에 장난감 포켓몬 하나를 모으고, 여덟 마리에 치즈버거, 열여섯 마리에 빅맥을 받을 수 있었다고 합니다. 별도 추첨 경품에 이 카드 게임도 있었고요. 카드 보러 왔다가 2009년 일본 맥도날드의 빅맥 획득 조건까지 공부하게 될 줄은 몰랐습니다.",
      ],
      image: { src: "/specs/stories/melee-box.webp", width: 320, height: 251, alt: "2009년 일본 포켓몬센터에서 판매한 난전 포켓몬 스크램블 카드 게임 박스" },
      additionalImage: { src: "/specs/stories/melee-board.webp", width: 320, height: 250, alt: "카드와 배틀 매트, 주사위가 놓인 공식 제품 소개 사진" },
      sources: [sources.release, sources.rally],
    },
    {
      title: "분모는 16인데 이브이가 19번입니다",
      body: [
        "여기서 한 번 더 찾게 되는 숫자가 있어요. 기본 구성은 016/016 비버통에서 끝나는데, 파치리스는 017/016, 삐딱구리는 018/016, 이브이는 019/016입니다. 분모가 갑자기 멈춘 것처럼 보이지만, 세 장은 일본 포켓몬 다이스키클럽의 별도 추첨 팩에 들어 있었습니다. 앞면 왼쪽 아래를 보면 스크램블 로고 외에 클럽 로고도 하나 더 있어요.",
        "Bulbapedia에 정리된 당시 이벤트를 보면, Wii 게임을 클리어한 뒤 표시되는 숫자를 클럽에 입력해 응모했고 당첨자 100명에게 세 장이 든 팩을 줬다고 해요. 일본 중고점 스루가야에도 같은 세 번호가 ‘캠페인 당첨 경품’으로 등록돼 있습니다. 당첨 인원은 도감에 남아 있는 기록이고, 지금 몇 장이나 남았는지는 확인할 수 없어요.",
        "그래서 ‘Melee 프로모’라고 검색할 때는 한 번 더 보게 됩니다. 피카츄·뮤츠·뮤는 그 16장짜리 판매 세트에 있었고, 분모를 넘어간 세 녀석이 추첨 경품이에요. 영어판 《Pokémon Rumble》도 기본 16종을 냈으니, 같은 포즈가 보여도 어느 판본인지 카드 사진부터 확인할 만합니다.",
      ],
      image: { src: "/specs/stories/melee-prizes.webp", width: 342, height: 512, alt: "일본 포켓몬 다이스키클럽 난전 포켓몬 스크램블 3장 추첨 경품 팩" },
      sources: [sources.checklist, sources.prizes],
    },
  ],
  baseSet: {
    title: "박스에 들어 있던 16장을 쫙 펼쳐봤어요",
    intro: "이상해꽃부터 비버통까지, 일본판 카드 번호순으로 놓아봤어요. 아쿠스타는 꼭 별 모양 팽이 같고, 디그다는 무리 지어 나와도 하나같이 표정이 태연합니다. 저는 이런 데서 한참 보게 되더라고요.",
    cards: research.baseSet.cards.map(({ number, name }) => ({
      number,
      name,
      src: `/specs/stories/melee/${number.split("/")[0]}.webp`,
    })),
  },
  market: {
    title: "피카츄 한 장의 가격표를 시간순으로 펼쳐봤어요",
    body: [
      `가격표 볼 준비 되셨나요? 일본판 피카츄 007/016이고, 등급은 전부 PSA 10이에요. 2024년 9월 eBay에선 ${meleePrice(2850, "USD")}에 팔렸어요. 2026년 8월엔 같은 eBay에서 고정가 ${meleePrice(19198.37, "USD")}. 그러다 10월 6일 일본 SNKRDUNK 기록을 보는데 ${meleePrice(pikachu.psa10Sold)}가 찍혀 있더라고요. 저 조그만 발 다시 한번 보고 가격표를 또 봤습니다.`,
      `기왕 본 김에 지금 올라온 매물도 눌러봤어요. 11월 21일에 보니 같은 PSA 10을 ${meleePrice(pikachu.psa10Ask)}부터 올려놨더라고요. 이쪽은 판매자가 받고 싶다고 적어둔 금액이에요. 아래 차트에는 실제로 팔린 날만 골라 넣었으니, 왼쪽부터 쭉 한번 보세요.`,
    ],
    note: "금액은 2026년 11월 20일 오후 3시 30분 환율을 적용해 원화로 바꾸고 천 원 단위로 반올림했어요. 배송비, 별도 수수료, 세금은 뺐습니다.",
  },
  sales: research.pikachuPsa10.map((sale) => ({
    ...sale,
    currency: sale.currency === "JPY" ? "JPY" as const : "USD" as const,
    source: sources[sale.source as keyof typeof sources],
  })),
  snkrdunk: snkrdunk.map((row) => ({
    ...row,
    source: sources[row.source as keyof typeof sources],
  })),
  gallery: [
    { src: "/specs/stories/melee-mewtwo.webp", width: 493, height: 680, alt: "짧은 발과 큰 꼬리를 가진 장난감 뮤츠 일본판 009/016" },
    { src: "/specs/stories/melee-mew.webp", width: 493, height: 680, alt: "공중에 떠 있는 분홍색 장난감 뮤 일본판 010/016" },
  ],
  closing: {
    title: "그래서 뮤츠 한 장은 살 만했느냐고요",
    body: [
      `그럼 제가 처음에 찜한 뮤츠는 좀 괜찮았을까요? 10월 6일 SNKRDUNK에서 PSA 10 뮤츠가 ${meleePrice(mewtwo.psa10Sold)}에 팔렸어요. 뮤도 9월 8일에 ${meleePrice(mew.psa10Sold)}였고요. 피카츄 가격을 먼저 보고 와서 순간 뮤츠가 싸 보였는데, 잠깐만요. 정신 차리고 숫자를 다시 읽어봤습니다.`,
      `궁금해서 예전 글도 뒤져봤어요. SNKRDUNK는 2023년 6월에 뮤츠 시세가 ${meleePrice(otherSales.oldMewtwoMarketJpyFrom)}부터라고 소개했더라고요. 그 글엔 몇 등급이 얼마에 팔렸는지까지는 없었어요. 그때 이런 가격으로 소개되던 카드였구나, 하고 보면 재밌는 대목입니다.`,
      `그래서 한 칸 내려가 봤죠. 11월 12일에 팔린 뮤츠 PSA 9는 ${meleePrice(290000)}. 11월 4일에 팔린 ‘PSA 8 이하’ 뮤는 ${meleePrice(160000)}였어요. eBay에선 2025년 11월에 피카츄 PSA 2가 ${meleePrice(otherSales.pikachuPsa2.amount, "USD")}에 낙찰된 적도 있고요. 전부 한 장씩 팔린 기록인데 가격표가 이렇게 다릅니다. ‘PSA 8 이하’처럼 여러 등급을 묶어 놓은 칸에선 저라면 매물 사진부터 눌러볼 것 같아요. 귀여운 얼굴 보러 갔다가 모서리까지 빤히 보게 되는 거죠.`,
      "저는 일단 뮤츠 가격표는 닫았습니다. 그러고 체크리스트를 쭉 보는데 디그다 011/016에서 또 멈췄어요. 땅에서 빼꼼 나온 애를 입체로 만들어놓으니까 이번엔 게임 캐릭터가 아니라 책상 위에 놓는 키캡 같더라고요. 피카츄 때문에 시작한 글인데, 사진을 실컷 보고 나니 제 바인더 욕심은 의외로 디그다 쪽으로 새고 있습니다. 여러분이라면 저 얼굴들 중에 누구 한 장 데려오실래요? 뮤츠조아요였습니다!",
    ],
  },
  links: Object.values(sources),
} as const;
