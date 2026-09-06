const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
  const absolute = path.resolve(ROOT, file);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Snapshot must be inside repository: ${file}`);
  }
  if (!fs.existsSync(absolute)) throw new Error(`Snapshot not found: ${file}`);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function normalize(doc) {
  if (doc.current?.traffic && doc.current?.community) {
    return {
      capturedAt: doc.currentCapturedAt || doc.current.capturedAt,
      traffic: doc.current.traffic,
      community: doc.current.community,
      topReferrers: doc.current.topReferrers || [],
      popularPaths: doc.current.popularPaths || [],
    };
  }
  if (doc.traffic && doc.community) {
    return {
      capturedAt: doc.capturedAt,
      traffic: doc.traffic,
      community: doc.community,
      topReferrers: doc.topReferrers || [],
      popularPaths: doc.popularPaths || [],
    };
  }
  throw new Error('Unsupported snapshot schema.');
}

function delta(a, b) {
  return Number(b || 0) - Number(a || 0);
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function mapRefs(items) {
  return new Map((items || []).map((item) => [item.referrer, item]));
}

function main() {
  const [beforePath, afterPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!beforePath || !afterPath) {
    throw new Error('Usage: node scripts/github-traffic-compare.js <before.json> <after.json> [--json]');
  }

  const before = normalize(readJson(beforePath));
  const after = normalize(readJson(afterPath));
  const beforeRefs = mapRefs(before.topReferrers);
  const afterRefs = mapRefs(after.topReferrers);
  const refNames = [...new Set([...beforeRefs.keys(), ...afterRefs.keys()])];

  const comparison = {
    schemaVersion: 1,
    project: 'douyin-taobao-cs',
    beforeCapturedAt: before.capturedAt,
    afterCapturedAt: after.capturedAt,
    semantics: {
      traffic: 'Rolling-14-day window comparison; positive/negative values are window differences, not cumulative acquisition.',
      community: 'Point-in-time cumulative count comparison.',
    },
    delta: {
      traffic: {
        views: delta(before.traffic.views, after.traffic.views),
        uniqueVisitors: delta(before.traffic.uniqueVisitors, after.traffic.uniqueVisitors),
        clones: delta(before.traffic.clones, after.traffic.clones),
        uniqueCloners: delta(before.traffic.uniqueCloners, after.traffic.uniqueCloners),
      },
      community: {
        stars: delta(before.community.stars, after.community.stars),
        forks: delta(before.community.forks, after.community.forks),
        openIssues: delta(before.community.openIssues, after.community.openIssues),
      },
      referrers: refNames.map((referrer) => {
        const a = beforeRefs.get(referrer) || { count: 0, uniques: 0 };
        const b = afterRefs.get(referrer) || { count: 0, uniques: 0 };
        return {
          referrer,
          count: delta(a.count, b.count),
          uniques: delta(a.uniques, b.uniques),
        };
      }),
    },
  };

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    return;
  }

  console.log('BossAI GitHub traffic snapshot comparison');
  console.log(`Before: ${before.capturedAt}`);
  console.log(`After:  ${after.capturedAt}`);
  console.log('');
  console.log('Rolling 14-day traffic window difference');
  console.log(`Views:           ${signed(comparison.delta.traffic.views)}`);
  console.log(`Unique visitors: ${signed(comparison.delta.traffic.uniqueVisitors)}`);
  console.log(`Clones:          ${signed(comparison.delta.traffic.clones)}`);
  console.log(`Unique cloners:  ${signed(comparison.delta.traffic.uniqueCloners)}`);
  console.log('');
  console.log('Cumulative community difference');
  console.log(`Stars:       ${signed(comparison.delta.community.stars)}`);
  console.log(`Forks:       ${signed(comparison.delta.community.forks)}`);
  console.log(`Open issues: ${signed(comparison.delta.community.openIssues)}`);
  console.log('');
  console.log('Referrer window differences');
  for (const item of comparison.delta.referrers.sort((a, b) => Math.abs(b.count) - Math.abs(a.count))) {
    console.log(`- ${item.referrer}: ${signed(item.count)} views / ${signed(item.uniques)} uniques`);
  }
}

try {
  main();
} catch (error) {
  console.error(`GitHub traffic comparison failed: ${error.message}`);
  process.exit(1);
}
