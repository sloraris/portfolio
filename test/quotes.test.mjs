import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotes, heroQuotesFrom, FALLBACK_QUOTES } from '../src/lib/quotes.mjs';

test('quotes are the list items of the page, in order, with entities decoded and inline markup stripped', () => {
  const html = `<h1>Quotes</h1><p>intro</p><h2>Star Wars</h2><ul><li>It&#39;s working!</li><li>Never <em>tell</em> me the odds.</li></ul>
    <h2>Robots</h2><ul><li>I'd smack ya &amp; run</li><li>  Spaced
    out  </li></ul>`;
  assert.deepEqual(parseQuotes(html), ["It's working!", 'Never tell me the odds.', "I'd smack ya & run", 'Spaced out']);
});

test('repeats and empty items are skipped, and a group label with a nested list is not a quote', () => {
  const html = '<ul><li>One</li><li>One</li><li></li><li>Group<ul><li>Inner</li></ul></li><li>Two</li></ul>';
  assert.deepEqual(parseQuotes(html), ['One', 'Inner', 'Two']);
});

test('no page, or a page without a list, falls back to a single line', () => {
  assert.deepEqual(heroQuotesFrom(undefined), FALLBACK_QUOTES);
  assert.deepEqual(heroQuotesFrom({ data: { html: '<p>nothing here</p>' } }), FALLBACK_QUOTES);
  assert.deepEqual(heroQuotesFrom({ data: { html: '<ul><li>Hi</li></ul>' } }), ['Hi']);
  assert.equal(FALLBACK_QUOTES.length, 1);
});
