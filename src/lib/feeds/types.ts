export type FeedPlatform = "instagram" | "x";

export type ParsedFeed = {
  platform: FeedPlatform;
  username: string;
};

export type FeedImage = {
  url: string;
  name: string;
};
