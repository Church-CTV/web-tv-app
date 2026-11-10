import { describe, expect, it } from 'vitest';
import { getAllVideos, groupVideosByMonth } from './FeedParser';

describe('legacy sermon title separators', () => {
  it.each([getAllVideos, (feed) => groupVideosByMonth(feed)['September 2026']])(
    'presents clean titles for Home and Search without mutating feed or media identity',
    (parse) => {
      const title = String.raw`By Faith: Follow \\ Pastor Ken Bushey \\ September 27, 2026`;
      const video = { id: 'sermon', title, url: 'https://media.example/message.mp4' };
      const feed = { 'September 2026': [video] };
      const [result] = parse(feed);
      expect(result.title).toBe('By Faith: Follow · Pastor Ken Bushey · September 27, 2026');
      expect(result.id).toBe(video.id);
      expect(result.url).toBe(video.url);
      expect(video.title).toBe(title);
    }
  );

  it.each(['A message with no separators', 'Grace / Peace', 'Message · Pastor'])(
    'preserves ordinary title %s',
    (title) => {
      expect(getAllVideos({ 'September 2026': [{ title }] })[0].title).toBe(title);
    }
  );

  it('trims empty separator fields and tolerates a missing title', () => {
    const videos = getAllVideos({
      'September 2026': [{ title: String.raw` \\ Message \\ \\ Pastor \\ ` }, { id: 'missing' }],
    });
    expect(videos[0].title).toBe('Message · Pastor');
    expect(videos[1].title).toBeUndefined();
  });
});
