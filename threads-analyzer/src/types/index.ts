// Shared types used by scraper and (later) AI analysis pipeline.
// Mirrors the schema in PRD §5.

export type Comment = {
  author: string;
  text: string;
};

export type Analysis = {
  popularityScore: number;
  contentType: string;
  popularityReasons: string[];
  commentThemes: { theme: string; share: number; summary: string }[];
  sentiment: { positive: number; neutral: number; negative: number };
  marketerInsights: string[];
};

export type Post = {
  id: string;
  url: string;
  content: string;
  postedAt: string;
  likes: number;
  replies: number;
  comments: Comment[];
  analysis?: Analysis;
};

export type Account = {
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  scrapedAt: string;
  posts: Post[];
};
