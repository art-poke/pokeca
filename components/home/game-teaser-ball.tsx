"use client";

import { useEffect, useRef, useState } from "react";
import { BallBadge } from "@/domains/game/components/ball-badge";
import styles from "./game-teaser.module.css";

export function GameTeaserBall() {
  const ball = useRef<HTMLSpanElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (!ball.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPlay(true);
        observer.disconnect();
      }
    });
    observer.observe(ball.current);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ball} className="absolute top-2 left-[calc(50%+0.5rem)]">
      <span className={styles.dropBall} data-play={play}><BallBadge tier={1} size={24} /></span>
    </span>
  );
}
