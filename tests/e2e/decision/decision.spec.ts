import fs from 'node:fs/promises';
import { test, expect, waitForAppReady } from '../fixtures';

const endpoint = process.env.DECISION_MODEL_URL;
const questions = {
  screen: {
    type: 'choice',
    instructions: 'Which screen is currently visible?',
    criteria: {
      home: 'Home grid is visible.',
      video: 'Video playback screen is visible.',
      other: 'Neither screen is visible.',
    },
  },
  next_action: {
    type: 'choice',
    instructions:
      'Reach row index 2 by pressing Down twice from row 0, then activate the focused card. Stop only when video_playing is true. Choose the next single action based on current state.',
    criteria: {
      down: 'Home grid is ready and focused_row is less than 2.',
      enter: 'Home grid is ready and focused_row equals 2. Activate the focused card.',
      wait: 'App is loading, focus is absent, or video screen is visible but playback has not started.',
      stop: 'Video screen is visible and video_playing is true. Task complete.',
    },
  },
};

test('Clef native joint head drives down twice then playback', async ({
  page,
  request,
}, testInfo) => {
  test.skip(!endpoint, 'Set DECISION_MODEL_URL to run the local model integration.');
  test.setTimeout(180000);
  const health = await request.get(`${endpoint}/health`, { timeout: 10000 }).catch(() => null);
  expect(health?.ok(), 'Configured decision server must be healthy.').toBe(true);
  // This scenario needs three rows. The shared fixture contains only two.
  const feed = JSON.parse(await fs.readFile('shared/test-fixtures/mock-feed.json', 'utf8'));
  feed['May 2026'] = feed['June 2026'].map((item: Record<string, unknown>) => ({
    ...item,
    id: `decision-${item.id}`,
    title: 'Decision Playback Target',
    releaseDate: '2026-05-28',
  }));
  await page.route(/\/feed\/?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) })
  );
  await page.goto('/');
  await waitForAppReady(page);
  const transcript: unknown[] = [];
  let completed = false;
  for (let step = 0; step < 10; step++) {
    const state = await page.evaluate(() => {
      const visible = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        return Boolean(el && el.getClientRects().length);
      };
      const rows = [...document.querySelectorAll('.content-grid__row-videos')];
      const focused = document.activeElement;
      const video = document.querySelector('#video-player') as HTMLVideoElement | null;
      return {
        app_ready: visible('#content-grid'),
        screen: visible('.video-screen') ? 'video' : visible('#content-grid') ? 'home' : 'other',
        focused_row: rows.findIndex((row) => focused !== null && row.contains(focused)),
        focus_title: focused?.textContent?.trim().slice(0, 120),
        video_playing: Boolean(video && !video.paused && !video.ended && video.readyState >= 2),
      };
    });
    const start = Date.now();
    const response = await request.post(`${endpoint}/v1/systemone`, {
      data: { model: 'clef-flash', state, questions },
      timeout: 120000,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const decision = await response.json();
    const action = decision.answers.next_action.choice;
    expect(['down', 'enter', 'wait', 'stop']).toContain(action);
    transcript.push({ step, state, decision, wall_ms: Date.now() - start });
    await fs.mkdir('test-results/decision', { recursive: true });
    await fs.writeFile(
      'test-results/decision/clef-home-play.jsonl',
      transcript.map((row) => JSON.stringify(row)).join('\n') + '\n'
    );
    if (action === 'stop') {
      expect(state.screen).toBe('video');
      expect(state.video_playing).toBe(true);
      completed = true;
      break;
    }
    if (action === 'down') await page.keyboard.press('ArrowDown');
    if (action === 'enter') await page.keyboard.press('Enter');
    if (action === 'wait') await page.waitForTimeout(250);
  }
  await testInfo.attach('decision-transcript', {
    body: JSON.stringify(transcript, null, 2),
    contentType: 'application/json',
  });
  expect(completed, 'Decision loop exhausted its bounded action budget.').toBe(true);
});
