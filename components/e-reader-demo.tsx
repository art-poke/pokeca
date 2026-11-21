"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./e-reader-demo.module.css";

type CardImage = { src: string; width: number; height: number; alt: string };

export function EReaderDemo({ machop }: { machop: CardImage }) {
  const figure = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = figure.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < 0.45) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.45 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <figure ref={figure} data-playing={visible} className={styles.demo}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.console}>
          <div className={styles.screen}>
            <span className={styles.result}>사이드 코드 인식</span>
          </div>
          <span className={styles.controls}>✚ <span>● ●</span></span>
        </div>
        <div className={styles.reader} />
        <div className={styles.card}>
          <Image src={machop.src} width={machop.width} height={machop.height} alt="" unoptimized />
        </div>
        <div className={styles.slot} />
      </div>
      <figcaption className="px-4 pb-4 text-sm leading-relaxed text-slate-100 sm:px-6">
        알통몬 카드의 왼쪽을 e리더에 통과시키면 게임보이 어드밴스가 사이드 코드를 읽습니다.
      </figcaption>
    </figure>
  );
}
