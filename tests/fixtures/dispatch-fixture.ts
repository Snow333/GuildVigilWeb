/**
 * The contract fixture moved to @sim/fixtures/dispatchFixture in 2.4 (the built
 * artifact renders it for the Playwright exit-criterion assertion). This
 * re-export keeps test imports stable; the stream is unchanged.
 */

export { buildFixtureDispatch } from '@sim/fixtures/dispatchFixture';
