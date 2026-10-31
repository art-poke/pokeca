import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/error-codes";

// 토스트는 이 래퍼로만 띄운다(컴포넌트에서 sonner 직접 import 금지).
// 에러 문구는 code 기반 번역을 거치므로 유저에게 일관된 메시지가 나간다.

export const showSuccessToast = (message: string) => toast.success(message);

export const showInfoToast = (message: string) => toast(message);

/** code(또는 메시지)를 받아 유저친화 문구로 띄운다. */
export const showErrorToast = (codeOrMessage?: string) =>
  toast.error(getErrorMessage(codeOrMessage));
