// Centralized Threads DOM selectors.
// When Threads ships a layout change, this is the first (and ideally only) file to touch.
//
// Strategy: prefer semantic / role selectors over generated class names.
// Fall back to multiple candidates per field; the scraper tries them in order
// and uses the first that yields a non-empty value.

export const SELECTORS = {
  profile: {
    // Pages: https://www.threads.net/@{handle}
    displayName: ['h1', 'header h1', '[data-testid="user-name"]'],
    bio: ['div[data-testid="user-bio"]', 'header section div[dir="auto"]'],
    // Followers count is rendered as text like "12.3K followers" in a link/anchor.
    followersAnchor: [
      'a[href$="/followers"]',
      'a[href*="/followers"]',
      'span:has-text("followers")',
    ],
  },

  feed: {
    // A single post card on the profile feed.
    postArticle: ['div[data-pressable-container="true"]', 'article'],
    // Permalink anchor inside a post card. Threads post URLs end with /post/{id}.
    permalink: ['a[href*="/post/"]', 'a[href*="/t/"]'],
    // Post body text container.
    body: ['div[dir="auto"]', 'span[dir="auto"]'],
  },

  post: {
    // On a single-post page (/@handle/post/{id}).
    bodyContainer: ['article', 'main'],
    likeButton: [
      'div[role="button"][aria-label*="Like"]',
      'svg[aria-label*="Like"]',
    ],
    // Number labels rendered next to like / reply icons.
    metricLabels: ['span[title]', 'div[dir="auto"] span'],
    // Reply / comment items.
    commentItem: [
      'div[data-pressable-container="true"]',
      'article div[role="article"]',
    ],
    // Comment author handle link.
    commentAuthor: ['a[href^="/@"]', 'a[href*="/@"]'],
    // Comment text body.
    commentBody: ['div[dir="auto"]', 'span[dir="auto"]'],
  },
} as const;
