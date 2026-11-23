import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { GAMES } from "@/domains/card-fragments/rules";
import guessName from "@/public/games/guess-name.webp";
import findTheCard from "@/public/games/find-the-card.webp";
import monsterball from "@/public/games/monsterball.webp";

export const metadata = { title: "게임 · Extended Art Archive" };

const games = [
  { href: "/card-fragments/name", ...GAMES.name, image: guessName.src },
  { href: "/card-fragments/odd", ...GAMES.odd, image: findTheCard.src },
  {
    href: "/play",
    title: "몬스터볼 게임",
    description: "같은 몬스터볼을 합쳐 더 큰 몬스터볼을 만드세요.",
    image: monsterball.src,
  },
];

export default function GamesPage() {
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">게임</h1>
      <ul className="mt-6 grid gap-4 sm:gap-5">
        {games.map(({ href, title, description, image }, index) => (
          <li key={href}>
            <Link data-track="select_game" href={href}
              className="group grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:rounded-3xl">
              <AppImage src={image} alt="" aspectRatio="2 / 1" fit="cover" className="w-full" priority={index === 0} />
              <div className="flex min-w-0 items-center justify-between gap-3 p-4 sm:p-6 lg:p-8">
                <div>
                  <h2 className="text-balance break-keep text-lg font-black tracking-tight sm:text-2xl lg:text-3xl">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground lg:mt-2 lg:text-base">{description}</p>
                </div>
                <ArrowRight aria-hidden className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
