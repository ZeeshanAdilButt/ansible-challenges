// Remove everything that challenge N created, and nothing else.
// Run: node toolkit/cleanup.mjs 3        (challenge 3's extras)
//      node toolkit/cleanup.mjs fleet    (the fleet: control, web1 ... and the network anp-fleet)
// It removes only containers, networks and volumes with the label anp.challenge=3 (or anp.fleet=1).
// It never runs "docker system prune" and never touches images or your repository.

import { cleanup, cleanupFleet, leftovers, fleetLeftovers, assertDocker } from './docker.js';

const arg = process.argv[2];
const isFleet = arg === 'fleet';
const n = Number(arg);
if (!isFleet && (!Number.isInteger(n) || n < 0 || arg === undefined)) {
  console.error('Usage: node toolkit/cleanup.mjs <challenge number>   or   node toolkit/cleanup.mjs fleet');
  process.exit(2);
}
assertDocker();
const what = isFleet ? 'the fleet' : `challenge ${n}`;
const label = isFleet ? 'anp.fleet=1' : `anp.challenge=${n}`;
const removed = isFleet ? cleanupFleet() : cleanup(n);
console.log(`Removed for ${what}: ${removed.containers.length} containers, ${removed.networks.length} networks, ${removed.volumes.length} volumes.`);
const left = isFleet ? fleetLeftovers() : leftovers(n);
console.log(`Still labelled ${label}: ${left.containers} containers, ${left.networks} networks, ${left.volumes} volumes.`);
process.exit(left.containers + left.networks + left.volumes === 0 ? 0 : 1);
