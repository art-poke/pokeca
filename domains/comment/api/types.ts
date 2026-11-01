export type CommentTarget = "artwork" | "post";

export type CommentNode = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  mine: boolean;
  deleted: boolean;
  replies: CommentNode[];
};

export type CreateCommentInput = {
  target: CommentTarget;
  targetId: string;
  body: string;
  parentId?: string;
};
