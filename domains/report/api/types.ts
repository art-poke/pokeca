export type ReportReason = "rights_holder" | "suspected_theft" | "other";

export type ReportInput = {
  reason: ReportReason;
  artworkId?: string;
  sourceUrl?: string;
  contact?: string;
  message?: string;
};
