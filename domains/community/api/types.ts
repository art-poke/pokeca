export type CreatePostInput = {
  board: string;
  title: string;
  body: string;
  imageUploadId?: string;
};

export type CreatePostResult = { id: string };
