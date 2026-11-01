import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/error-codes";

// 토스트는 이 래퍼로만 띄운다(컴포넌트에서 sonner 직접 import 금지).
// 에러 문구는 code 기반 번역을 거치므로 유저에게 일관된 메시지가 나간다.

export const showSuccessToast = (message: string) => toast.success(message);

export const showInfoToast = (message: string) => toast(message);

/** code를 받아 레지스트리 문구로 띄운다(code SSOT). */
export const showErrorToast = (codeOrMessage?: string) =>
  toast.error(getErrorMessage(codeOrMessage));

/** 이미 번역된 문구(클라 검증 메시지, upload errorMessage 등)를 그대로 띄운다. */
export const showErrorMessage = (message: string) => toast.error(message);

/** 비회원 액션 시 로그인 유도 토스트(액션 버튼 포함). */
export const showLoginNudge = (message: string, onLogin: () => void) =>
  toast(message, { action: { label: "로그인", onClick: onLogin } });

/** 제목 + 설명이 있는 안내 토스트(예: 인쇄 안내). */
export const showNoticeToast = (message: string, description: string) =>
  toast.message(message, { description, duration: 8000 });
