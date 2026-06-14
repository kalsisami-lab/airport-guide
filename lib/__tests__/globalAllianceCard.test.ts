import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalAllianceCard from '../../components/GlobalAllianceCard';
import type { AllianceAccess } from '../eligibility';

const starAccess: AllianceAccess = {
  alliance: 'star-alliance',
  tier:     'Gold',
  message:  'Access granted via Star Alliance Gold status',
};

const oneworldAccess: AllianceAccess = {
  alliance: 'oneworld',
  tier:     'Sapphire',
  message:  'Access granted via oneworld Sapphire status',
};

const skyteamAccess: AllianceAccess = {
  alliance: 'skyteam',
  tier:     'Elite Plus',
  message:  'Access granted via SkyTeam Elite Plus status',
};

describe('GlobalAllianceCard — renders correctly without airport-specific content', () => {

  test('star-alliance card contains "Star Alliance"', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: starAccess, iataCode: 'HEL' }),
    );
    assert.ok(html.includes('Star Alliance'), 'should contain the alliance name');
  });

  test('IATA code passed as prop does not appear in rendered output', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: starAccess, iataCode: 'HEL' }),
    );
    assert.ok(!html.includes('HEL'), 'airport IATA code must not be rendered');
  });

  test('specific partner airlines (Lufthansa) are not listed', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: starAccess, iataCode: 'HEL' }),
    );
    assert.ok(!html.includes('Lufthansa'), 'hardcoded partner airline list must be removed');
  });

  test('oneworld card does not show arrival airport IATA', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: oneworldAccess, iataCode: 'LHR' }),
    );
    assert.ok(!html.includes('LHR'), 'IATA code "LHR" must not appear');
    assert.ok(html.includes('oneworld'), 'should contain "oneworld"');
  });

  test('skyteam card does not show airport IATA or partner-specific airlines', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: skyteamAccess, iataCode: 'CDG' }),
    );
    assert.ok(!html.includes('CDG'), 'IATA code "CDG" must not appear');
    assert.ok(!html.includes('Air France'), 'partner airline list must be removed');
    assert.ok(html.includes('SkyTeam'), 'should contain "SkyTeam"');
  });

  test('subtitle shows worldwide scope, not airport-specific label', () => {
    const html = renderToStaticMarkup(
      createElement(GlobalAllianceCard, { access: starAccess, iataCode: 'HEL' }),
    );
    // Must contain worldwide phrasing
    assert.ok(html.includes('Worldwide') || html.includes('worldwide'), 'subtitle must say "Worldwide"');
    // Must NOT contain the old "HEL · Business Class lounges" format
    assert.ok(!html.includes(' · Business Class lounges'), 'old airport-specific subtitle must be gone');
  });
});
