export type ProfileLink = { label: string; url: string };
export type ProfileActivity = { place: string; handle: string };

export type UpdateProfileInput = {
  displayName: string;
  handle?: string; // 발행용 주소 이름(선택, 설정 시)
  avatarUploadId?: string;
  email?: string | null;
  intro?: string | null;
  links?: ProfileLink[];
  activities?: ProfileActivity[];
};
