import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn 표준: clsx로 조건부 클래스 합치고 tailwind-merge로 충돌 유틸리티를 정리한다.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
