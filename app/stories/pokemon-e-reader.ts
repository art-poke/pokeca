import research from "@/docs/research/pokemon-e-reader.json";

const imageRoot = "/specs/stories/e-reader";

function photo(file: keyof typeof research.images, alt: string, credit?: string) {
  const size = research.images[file];
  return { src: `${imageRoot}/${file}`, width: size.width, height: size.height, alt, credit };
}

const machopCards = [
  photo("machop.webp", "알통몬 Expedition 117/165 앞면", "알통몬 · 117/165"),
  photo("machoke.webp", "근육몬 Expedition 85/165 앞면", "근육몬 · 85/165"),
  photo("machamp.webp", "괴력몬 Expedition 51/165 앞면", "괴력몬 · 51/165"),
];

const japaneseBundleCards = [
  [1, "알통몬", "021"], [2, "근육몬", "042"], [3, "괴력몬", "089"], [4, "피츄", "082"],
  [5, "통통코", "002"], [6, "날쌩마", "073"], [7, "피카츄", "016"], [8, "고오스", "019"],
  [9, "럭키", "047"], [10, "또가스", "001"],
] as const;

function nesCards(prefix: "donkey" | "pinball", title: string) {
  return ([1, 2, 3, 4, 5] as const).map((number) =>
    photo(`${prefix}-${number}.webp`, `${title} ${number}/5 앞면`, `${number}/5`),
  );
}

type CardSale = (typeof research.market.lugiaUs)[number]
  | (typeof research.market.lugiaJp)[number]
  | (typeof research.market.charizard)[number]
  | (typeof research.market.mewtwo)[number];

function eReaderPrice(won: number) {
  const units = Math.round(won / 10_000);
  const hundredMillions = Math.floor(units / 10_000);
  const remainder = units % 10_000;
  return `약 ${hundredMillions ? `${hundredMillions}억 ` : ""}${remainder ? `${remainder.toLocaleString("ko-KR")}만 ` : ""}원`;
}

function saleInWon(sale: CardSale) {
  const krw = sale.usd * research.fx.usdToKrw;
  return { ...sale, krw, won: eReaderPrice(krw) };
}

const japaneseLugia = {
  src: `${imageRoot}/lugia-original-jp.webp`, width: 484, height: 686,
  alt: "왼쪽에 빗금이 있는 넓은 노란 여백과 하단에 검은 도트코드가 있는 2002년 일본판 크리스탈 루기아",
  credit: "일본 e3 · 090/087 · SNKRDUNK / © Pokémon",
};
const englishLugia = {
  src: `${imageRoot}/lugia-original.webp`, width: 600, height: 825,
  alt: "하단에 검은 도트코드가 찍힌 영문 Aquapolis 루기아 149/147",
  credit: "북미 Aquapolis · 149/147 · Pokémon TCG API / © Pokémon",
};
const koreanReprint = {
  src: `${imageRoot}/lugia-30th-ko.webp`, width: 600, height: 838,
  alt: "피카츄 30주년 마크와 금빛 무늬가 들어간 한국어 크리스탈 루기아 142/103",
  credit: "한국 30주년 복각 · 142/103 · 포켓몬스토어 / © Pokémon",
};

export const eReaderStory = {
  id: "4c257ff8-c9bb-4a28-9476-a528adb5be3e",
  slug: "pokemon-e-reader",
  category: "release",
  title: "이 루기아카드 센터링이 왜 우쏠이에요?",
  summary: "센터링부터 의심했는데, 닌텐도는 그 자리에 게임을 넣었더라고요. 게임보이에 긁던 포켓몬 카드가 24년 뒤 한글판 루기아로 돌아온 이야기입니다.",
  card: "포켓몬 카드 e · 크리스탈 루기아 090/087 → 30주년 루기아 142/103",
  author: "뮤츠조아요",
  researchedOn: research.researchedOn,
  shareImage: {
    url: "/specs/stories/og-pokemon-e-reader.jpg", width: 1200, height: 630,
    alt: "영문판 크리스탈 루기아 원본과 일본 30주년 복각판을 나란히 놓은 카드 이야기 표지",
  },
  image: japaneseLugia,
  intro: [
    "안녕하세요 뮤츠조아요입니다. 오늘은 센터링부터 의심하게 만든 포켓몬 e카드 낋여와봤습니다.",
    "루기아를 보다가 ‘이거 센터링 우쏠인데?’ 싶었어요. 우쏠은 우측 쏠림의 줄임말이에요. 센터링은 카드의 양쪽 여백이 얼마나 고르게 찍혔는지 보는 말이고요. 그런데 이 카드는 왼쪽 노란 띠가 유독 넓고, 그림도 기술 설명도 줄 맞춰 오른쪽으로 가 있어요. 아래를 보니 검은 점들이 모인 짧은 줄도 하나 있고요.",
    "그 여백의 정체를 알고 나니까 카드 보는 순서가 바뀌었습니다. 이 디자인이 한창이던 2002년에는 카드 한 장을 뽑아서, 덱에 넣기 전에 게임보이에 긁어볼 수 있었거든요.",
  ],
  reader: {
    title: "카드 한 장을 게임보이에 긁던 시절",
    body: [
      "정확히는 닌텐도의 휴대용 게임기 게임보이 어드밴스(GBA)에 카드 e리더를 꽂았어요. 게임 팩이 들어가는 슬롯에 리더를 끼우고, 리더 옆의 긴 홈으로 카드를 쓱 통과시키는 방식입니다. 아래 닌텐도 사진을 보면 카드가 게임기 화면 옆을 가로지르죠. 교통카드처럼 갖다 대는 동작을 상상했다가, 옛날 마트에서 카드를 긁던 모습이 먼저 떠올랐어요.",
    ],
    image: {
      src: `${imageRoot}/reader.webp`, width: 280, height: 220,
      alt: "게임보이 어드밴스에 꽂힌 카드 e리더의 홈으로 카드를 밀어 넣는 손",
      credit: "카드를 긁는 모습. 닌텐도 당시 제품 안내.",
    },
    afterImage: [
      "검은 막대처럼 보이는 부분을 가까이 보면 작은 점들이 모여 있어요. 리더는 그 점을 빛으로 읽었습니다. 닌텐도 안내를 보면 아래쪽의 짧은 ‘베이스 코드’는 도감과 진화 정보를, 왼쪽의 긴 ‘사이드 코드’는 미니게임과 짧은 애니메이션 등을 맡았어요. 카드에 따라 찍힌 코드와 읽을 수 있는 내용이 달랐고요. 알통몬 왼쪽의 긴 코드를 루기아 왼쪽의 빗금과 비교해 보세요. 루기아는 아래쪽의 짧은 코드를 읽을 수 있고, 왼쪽의 빗금은 장식입니다.",
      "저 점들이 인터넷 주소라서 뭔가를 내려받는 구조도 아니었어요. 데이터가 종이에 들어 있었습니다. 영문 Expedition에선 알통몬 117번, 근육몬 85번, 괴력몬 51번을 모아 각각의 사이드 코드를 읽으면 《Machop At Work》가 열렸어요. 화면에서 날아오는 돌을 주먹으로 부수는 게임인데, 잘하면 알통몬이 진화합니다. 카드로 진화 계열을 다 모았더니 게임기에서도 진화하는 셈이죠.",
    ],
  },
  machopCards,
  japanLaunch: {
    title: "일본 리더기 상자에 포켓몬 10장이 들어 있었습니다",
    body: [
      "2001년 12월 1일, 일본 닌텐도는 카드 e리더(AGB-010)를 세전 5,800엔에 내놨어요. 상자에는 리더 1대와 포켓몬 카드 e 애플리케이션 팩 1개(고정 10장)가 들어 있었고, 개봉 사진에는 설명서와 안내지들도 보입니다. 투명 봉투 맨 위에는 알통몬이 있네요.",
      "같은 날 매장에 나온 기본 확장팩은 세전 191엔에 랜덤 5장이 들어 있는 별매 부스터였어요. 사진에서 알통몬이 보이는 투명 봉투가 동봉품이고, 그림이 인쇄된 금속 포장은 별매 e1 부스터예요.",
    ],
  },
  japanPackage: [
    photo("jp-box.webp", "일본판 AGB-010 상자 앞면과 리더기가 들어 있는 트레이", "일본판 AGB-010 상자와 본체"),
    photo("jp-app-pack.webp", "알통몬이 맨 위에 보이는 투명 포장 애플리케이션 팩", "동봉 애플리케이션 팩 · 10장"),
    photo("jp-opened.webp", "일본판 상자, 트레이의 본체, 카드 봉투와 설명서를 한데 펼친 실물 사진", "개봉 구성 · 본체 1대, 카드 팩 1개, 설명서와 안내지"),
    photo("pack-jp-1.webp", "별매 기본 확장팩 e1 포장", "별매 e1 기본 확장팩 · 랜덤 5장"),
  ],
  japaneseBundlePhoto: photo("jp-app-cards.webp", "알통몬부터 또가스까지 일본판 동봉 카드 10장이 펼쳐진 실물 사진", "일본판 애플리케이션 팩 고정 10장 · 메루카리 출품 사진"),
  japaneseBundleCards: japaneseBundleCards.map(([index, name, number]) =>
    photo(`jp-app-${index}.webp`, `일본판 기본 확장팩 ${name} ${number}/128 카드 앞면`, `${name} · ${number}/128`),
  ),
  usLaunch: {
    title: "미국 리더기에는 동키콩이나 핀볼이 따라왔어요",
    body: [
      "2002년 9월 16일 닌텐도 오브 아메리카가 발표한 권장가는 39.95달러. 북미 블리스터 안에는 리더 1대와 카드 팩 두 개가 들어갔어요. 하나는 NES 게임 팩 5장으로, 포장에 표시된 《동키콩 주니어》 또는 《핀볼》 가운데 한 종류가 들어 있었습니다. 나머지 하나는 고정 샘플 5장 팩이에요.",
      "샘플 팩의 포켓몬 세 장은 아까 본 알통몬·근육몬·괴력몬 그대로예요. 네 번째는 게임 앤 워치 《Manhole-e》, 다섯 번째는 게임큐브 《동물의 숲》에 연결해 쓰는 프로모 카드 04-E001입니다. 동키콩이나 핀볼은 1번부터 5번까지 한 게임 분량을 전부 읽어야 했어요.",
    ],
  },
  usPackage: [
    photo("us-box.webp", "북미판 동키콩 주니어 동봉 닌텐도 e리더 블리스터 앞면", "북미판 리더기 블리스터 · RF Generation"),
    photo("us-sample-pack.webp", "북미 e리더 동봉 Sample Pack 5 Card Set의 은색 포장", "동봉 샘플 팩 · 5장"),
    photo("us-opened.webp", "동키콩 주니어와 샘플 팩, 설명서 위의 북미 리더 본체를 펼친 사진", "북미 키트 개봉 · 리더 1대, 카드 팩 2개, 설명서"),
  ],
  usSampleCards: [
    ...machopCards,
    photo("manhole.webp", "게임 앤 워치 Manhole-e 02-A001 앞면", "Manhole-e · 02-A001"),
    photo("animal-crossing.webp", "북미 동물의 숲 샘플 프로모 04-E001 앞면", "동물의 숲 · 04-E001"),
  ],
  nesBundles: [
    { title: "동키콩 주니어 카드 5장", pack: photo("donkey-pack.webp", "동키콩 주니어 e리더 5장 팩 포장", "동키콩 주니어 팩"), cards: nesCards("donkey", "동키콩 주니어") },
    { title: "핀볼 카드 5장", pack: photo("pinball-pack.webp", "별매 핀볼 e리더 5장 팩 블리스터", "핀볼 팩 · 별매 포장 사진"), cards: nesCards("pinball", "핀볼") },
  ],
  otherProducts: [
    {
      title: "동물의 숲+ 카드 e · 일본 1탄",
      description: "세전 191엔에 5장. 팩에서 나온 카드의 코드나 암호를 게임큐브 마을 편지에 쓸 수 있었어요.",
      pack: photo("jp-animal-pack.webp", "일본 동물의 숲+ 카드 e 시리즈 1 봉입 팩 실물"),
      card: photo("jp-animal-card.webp", "일본 동물의 숲+ 카드 e 001번 앞면", "카드 예시 · 001번"),
      catalog: research.sources.japanAnimal,
    },
    {
      title: "햄타로 카드 e · 일본",
      description: "세전 191엔에 5장. 발매 시 카드 목록은 34종이고, 리더에 긁으면 햄스터 소개나 미니게임을 볼 수 있었어요.",
      pack: photo("hamtaro-pack.webp", "일본 햄타로 카드 e 부스터 포장"),
      card: photo("hamtaro-card.webp", "일본 햄타로 카드 e 리본 앞면", "카드 예시 · 리본"),
      catalog: research.sources.hamtaro,
    },
  ],
  setIntro: "포켓몬 부스터 이름도 바다를 건너며 달라졌어요. 일본 정규 확장팩은 5장씩 들어 있는 다섯 탄, 북미는 9장씩 들어 있는 세 세트였습니다. Aquapolis와 Skyridge는 일본 팩 두 탄씩의 카드를 묶어 재구성했어요. 팩 그림은 지역별 대표 도안입니다.",
  sets: {
    e1: { code: "e1", name: "기본 확장팩", japanese: "基本拡張パック", date: "2001.12.01", pack: photo("pack-jp-1.webp", "일본 e1 기본 확장팩 포장"), catalog: research.sources["base-expansion-pack"], english: "expedition" },
    e2: { code: "e2", name: "지도에 없는 마을", japanese: "地図にない町", date: "2002.03.08", pack: photo("pack-jp-2.webp", "일본 e2 지도에 없는 마을 팩 포장"), catalog: research.sources["the-town-on-no-map"], english: "aquapolis" },
    e3: { code: "e3", name: "바다에서 불어오는 바람", japanese: "海からの風", date: "2002.05.24", pack: photo("pack-jp-3.webp", "일본 e3 바다에서 불어오는 바람 팩 포장"), catalog: research.sources["wind-from-the-sea"], english: "aquapolis" },
    e4: { code: "e4", name: "갈라진 대지", japanese: "裂けた大地", date: "2002.08.23", pack: photo("pack-jp-4.webp", "일본 e4 갈라진 대지 팩 포장"), catalog: research.sources["split-earth"], english: "skyridge" },
    e5: { code: "e5", name: "신비한 산", japanese: "神秘なる山", date: "2002.10.04", pack: photo("pack-jp-5.webp", "일본 e5 신비한 산 팩 포장"), catalog: research.sources["mysterious-mountains"], english: "skyridge" },
  },
  englishSets: {
    expedition: { name: "Expedition", year: "2002", pack: photo("pack-us-1.webp", "북미 Expedition 리자몽 부스터 포장"), catalog: research.sources.expedition },
    aquapolis: { name: "Aquapolis", year: "2003", pack: photo("pack-us-2.webp", "북미 Aquapolis 윈디 부스터 포장"), catalog: research.sources.aquapolis },
    skyridge: { name: "Skyridge", year: "2003", pack: photo("pack-us-3.webp", "북미 Skyridge 칠색조 부스터 포장"), catalog: research.sources.skyridge },
  },
  catalogs: [research.sources.codeIndex, research.sources.jpTcgCatalog, research.sources.usTcgCatalog, research.sources.japanCatalog, research.sources.usCards],
  crystals: {
    title: "수집가들이 말하는 ‘크리스탈’은 어디 써 있을까?",
    body: [
      "루기아 그림 아래에 적힌 ‘크리스탈 타입’을 보세요. 반짝이는 카드라서 팬들이 붙인 말처럼 들리는데, 실제 카드에 쓰인 능력 이름이에요. 루기아는 손에서 불꽃·물·초 에너지 중 하나를 붙이면 그 턴이 끝날 때까지 그 타입으로 바뀝니다. 홀로에 보이는 소용돌이 무늬는 따로 ‘스월’이라고 불러요. 루기아와 리자몽은 일본판과 북미판 모두 카드 번호가 분모를 넘어갑니다.",
      "위 표에서 Aquapolis는 일본 팩 두 개에 대응하죠. 이 루기아가 나온 건 그중 e3 「바다에서 불어오는 바람」이에요. 리자몽도 Skyridge에 대응하는 일본 팩 둘 중 e5 「신비한 산」에서 나왔습니다. 뮤츠는 e1 「기본 확장팩」의 홀로 카드가 북미 Expedition에도 실렸어요. 같은 그림의 영문 비홀로 56/165에는 하단 도트코드가 있고, 아래에 실은 20/165 홀로는 코드 자리에 장식 무늬가 있어요. 같은 그림을 사더라도 기기에 읽히는 카드를 찾는다면 번호와 앞면이 둘 다 중요했습니다.",
    ],
  },
  examples: [
    {
      name: "크리스탈 루기아", image: englishLugia,
      japaneseSet: "e3", japaneseNumber: "090/087", englishNumber: "149/147",
    },
    {
      name: "크리스탈 리자몽",
      image: photo("charizard.webp", "북미 Skyridge 크리스탈 리자몽 146/144 앞면"),
      japaneseSet: "e5", japaneseNumber: "089/088", englishNumber: "146/144",
    },
    {
      name: "뮤츠 홀로",
      image: photo("mewtwo.webp", "북미 Expedition 뮤츠 홀로 20/165 앞면"),
      japaneseSet: "e1", japaneseNumber: "118/128", englishNumber: "20/165",
    },
  ],
  anniversary: {
    title: "24년 뒤, 그 루기아가 한글로 돌아왔습니다",
    body: [
      "한국에선 당시 한국어 e 확장팩이나 카드 e리더의 정식 발매 기록을 확인하기 어려웠어요. 그런데 2026년 9월 16일, 포켓몬코리아가 한 팩 3,500원에 출시한 「30th CELEBRATION」에서 그 루기아를 한글로 볼 수 있게 됐습니다. 기무라 나오요가 그린 하얀 날개와 번개, 오른쪽으로 치우쳐 보이던 그림 위치까지 그대로예요. 한글 카드에도 ‘크리스탈 타입’이라고 적혀 있습니다. 한 상자는 7만 원에 20팩. 한 팩에는 30주년 피카츄 1장과 기본 에너지 1장을 포함해 총 6장이 들어 있어요. 크리스탈 루기아는 랜덤 수록입니다.",
      "이번엔 아래쪽을 봐주세요. 2002년 일본 원본 090/087에는 검은 도트코드가 있고, 2026년 한글판 142/103에는 그 자리에 금빛 무늬가 들어갔어요. 그림 왼쪽 아래엔 피카츄 얼굴 모양의 30주년 마크도 생겼고요. 일본 복각판도 142/103이고, 북미 클래식 복각판은 Aquapolis의 149/147 번호를 이어받았습니다. 같은 30주년 팩의 영문 121/128 루기아는 그림과 기술이 다른 별도 카드예요.",
    ],
  },
  koreanPack: photo("pack-kr.webp", "한글 30th CELEBRATION 부스터 박스와 낱팩 공식 이미지", "한글판 30th CELEBRATION 박스와 낱팩 · 포켓몬스토어"),
  comparison: [japaneseLugia, koreanReprint],
  market: {
    fx: research.fx,
    korean: research.market.korean,
    koreanSource: research.sources.koreanMarket,
    paymentSource: research.sources.paymentTracker,
    lugiaTrend: research.market.lugiaUs.map(saleInWon),
    groups: [
      { name: "크리스탈 루기아 · 북미 Aquapolis 149/147", image: englishLugia, sales: research.market.lugiaUs.slice(-1).map(saleInWon) },
      { name: "크리스탈 루기아 · 일본 e3 090/087 초판", image: japaneseLugia, sales: research.market.lugiaJp.slice(1).map(saleInWon) },
      { name: "크리스탈 리자몽 · 북미 Skyridge 146/144", image: { src: `${imageRoot}/charizard.webp`, width: 600, height: 825, alt: "북미 Skyridge 크리스탈 리자몽 146/144 앞면" }, sales: research.market.charizard.map(saleInWon) },
      { name: "뮤츠 홀로 · 북미 Expedition 20/165", image: { src: `${imageRoot}/mewtwo.webp`, width: 600, height: 825, alt: "북미 Expedition 뮤츠 홀로 20/165 앞면" }, sales: research.market.mewtwo.slice(1).map(saleInWon) },
    ],
  },
  closing: [
    "일본 원본을 찾을 땐 ‘ポケモンカードe ルギア 090/087’, 북미 원본을 찾을 땐 ‘Aquapolis Crystal Lugia 149/147’로 검색해 보세요. 영문 복각판도 같은 번호를 쓰니 사진의 30주년 마크까지 보면 됩니다. 한글 복각은 ‘30th CELEBRATION 루기아 142/103’이에요.",
    "처음엔 루기아 오른쪽 여백부터 재보고 싶었는데, 이제는 카드 아래부터 보게 돼요. 루기아 아래에 촘촘한 점이 보이면 한때 게임보이에 긁을 수 있었던 원본이고, 피카츄 마크와 금빛 무늬가 보이면 그 시절 모양까지 데려온 복각판이에요. 새 루기아가 옛날 루기아랑 똑같아 보였던 건 날개 때문인 줄 알았는데, 저는 그 넓은 왼쪽 여백이 제일 반갑더라고요.",
  ],
  links: Object.values(research.sources),
} as const;
