// Core types for Azure DevOps MCP

export interface PRIdentifier {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
}

export interface OperationResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PRDetails {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  isDraft: boolean;
  mergeStatus: string;
  sourceBranch: string;
  targetBranch: string;
  createdBy: string;
  createdByEmail: string;
  creationDate: string;
  reviewers: ReviewerInfo[];
  url: string;
}

export interface ReviewerInfo {
  displayName: string;
  email: string;
  vote: string;
  voteNumber: number;
  isRequired: boolean;
}

export interface PRListItem {
  id: number;
  title: string;
  status: string;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  createdBy: string;
  createdByEmail: string;
  reviewers: ReviewerInfo[];
  url: string;
}

export interface ThreadInfo {
  id: number;
  status: string;
  publishedDate: string;
  lastUpdatedDate: string;
  isDeleted: boolean;
  comments: CommentInfo[];
  threadContext?: ThreadContext;
}

export interface CommentInfo {
  id: number;
  parentCommentId: number;
  content: string;
  author: string;
  authorEmail: string;
  publishedDate: string;
  lastUpdatedDate: string;
  isDeleted: boolean;
  commentType: string;
}

export interface ThreadContext {
  filePath: string;
  rightFileStart?: { line: number; offset: number };
  rightFileEnd?: { line: number; offset: number };
  leftFileStart?: { line: number; offset: number };
  leftFileEnd?: { line: number; offset: number };
}

// Vote values as defined by Azure DevOps API
export const VoteValues = {
  APPROVED: 10,
  APPROVED_WITH_SUGGESTIONS: 5,
  NO_VOTE: 0,
  WAITING_FOR_AUTHOR: -5,
  REJECTED: -10,
} as const;

export const VoteLabels: Record<number, string> = {
  10: "Approved",
  5: "Approved with suggestions",
  0: "No vote",
  [-5]: "Waiting for author",
  [-10]: "Rejected",
};

// Thread status values
export const ThreadStatusValues = {
  ACTIVE: 1,
  FIXED: 2,
  WONT_FIX: 3,
  CLOSED: 4,
  BY_DESIGN: 5,
  PENDING: 6,
} as const;

export const ThreadStatusLabels: Record<number, string> = {
  1: "active",
  2: "fixed",
  3: "wontFix",
  4: "closed",
  5: "byDesign",
  6: "pending",
};

// Comment type values
export const CommentTypeValues = {
  UNKNOWN: 0,
  TEXT: 1,
  CODE_CHANGE: 2,
  SYSTEM: 3,
} as const;
