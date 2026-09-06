const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'liufeng1976/douyin-taobao-cs';
const BASELINE_PATH = path.join(ROOT, 'governance', 'github-traffic-baseline-2026-09-06.json');

function runGh(args) {
  return execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ghJson(args) {
  const raw = runGh(args);
  return raw ? JSON.parse(raw) : null;
}

function delta(current, baseline) {
  return Number(current || 0) - Number(baseline || 0);
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function referrerMap(items = []) {
  return new Map(items.map((item) => [item.referrer, item]));
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline not found: ${path.relative(ROOT, BASELINE_PATH)}`);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const views = ghJson(['api', `repos/${REPO}/traffic/views`]);
  const clones = ghJson(['api', `repos/${REPO}/traffic/clones`]);
  const referrers = ghJson(['api', `repos/${REPO}/traffic/popular/referrers`]) || [];
  const paths = ghJson(['api', `repos/${REPO}/traffic/popular/paths`]) || [];
  const community = ghJson(['repo', 'view', REPO, '--json', 'stargazerCount,forkCount,issues']);

  const current = {
    capturedAt: new Date().toISOString(),
    window: 'GitHub repository traffic API rolling 14 days',
    traffic: {
      views: views.count,
      uniqueVisitors: views.uniques,
      clones: clones.count,
      uniqueCloners: clones.uniques,
    },
    community: {
      stars: community.stargazerCount,
      forks: community.forkCount,
      openIssues: community.issues.totalCount,
    },
    topReferrers: referrers,
    popularPaths: paths,
  };

  const baselineRefsForSignals = referrerMap(baseline.topReferrers);
  const newExternalReferrers = current.topReferrers
    .filter((item) => item.referrer !== 'github.com' && !baselineRefsForSignals.has(item.referrer))
    .map((item) => ({ referrer: item.referrer, count: item.count, uniques: item.uniques }));

  const report = {
    schemaVersion: 1,
    project: 'douyin-taobao-cs',
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: current.capturedAt,
    comparisonSemantics: {
      traffic: 'Rolling-14-day window delta; not cumulative growth.',
      community: 'Point-in-time cumulative count delta.',
    },
    current,
    deltaFromBaseline: {
      traffic: {
        views: delta(current.traffic.views, baseline.traffic.views),
        uniqueVisitors: delta(current.traffic.uniqueVisitors, baseline.traffic.uniqueVisitors),
        clones: delta(current.traffic.clones, baseline.traffic.clones),
        uniqueCloners: delta(current.traffic.uniqueCloners, baseline.traffic.uniqueCloners),
      },
      community: {
        stars: delta(current.community.stars, baseline.community.stars),
        forks: delta(current.community.forks, baseline.community.forks),
        openIssues: delta(current.community.openIssues, baseline.community.openIssues),
      },
    },
    signals: {
      firstPublicIssue: baseline.community.openIssues === 0 && current.community.openIssues > 0,
      starsIncreased: current.community.stars > baseline.community.stars,
      forksIncreased: current.community.forks > baseline.community.forks,
      newExternalReferrers,
      materialChange:
        (baseline.community.openIssues === 0 && current.community.openIssues > 0) ||
        current.community.stars > baseline.community.stars ||
        current.community.forks > baseline.community.forks ||
        newExternalReferrers.length > 0,
    },
  };

  const savePath = argValue('--save');
  const saveDir = argValue('--save-dir');
  const saveReport = (target) => {
    const absolute = path.resolve(ROOT, target);
    const relative = path.relative(ROOT, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Snapshot output must point inside the repository.');
    }
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(`Saved GitHub traffic report: ${relative}`);
  };

  if (savePath) saveReport(savePath);
  if (saveDir) {
    const stamp = current.capturedAt.replace(/[:.]/g, '-');
    saveReport(path.join(saveDir, `github-traffic-${stamp}.json`));
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('BossAI GitHub traffic report');
  console.log(`Baseline: ${baseline.capturedAt}`);
  console.log(`Current:  ${current.capturedAt}`);
  console.log('');
  console.log('Rolling 14-day traffic (window delta, not cumulative growth)');
  console.log(`Views:           ${current.traffic.views} (${signed(report.deltaFromBaseline.traffic.views)})`);
  console.log(`Unique visitors: ${current.traffic.uniqueVisitors} (${signed(report.deltaFromBaseline.traffic.uniqueVisitors)})`);
  console.log(`Clones:          ${current.traffic.clones} (${signed(report.deltaFromBaseline.traffic.clones)})`);
  console.log(`Unique cloners:  ${current.traffic.uniqueCloners} (${signed(report.deltaFromBaseline.traffic.uniqueCloners)})`);
  console.log('');
  console.log('Community counts (cumulative delta)');
  console.log(`Stars:       ${current.community.stars} (${signed(report.deltaFromBaseline.community.stars)})`);
  console.log(`Forks:       ${current.community.forks} (${signed(report.deltaFromBaseline.community.forks)})`);
  console.log(`Open issues: ${current.community.openIssues} (${signed(report.deltaFromBaseline.community.openIssues)})`);
  console.log('');
  console.log('Actionable signals');
  if (!report.signals.materialChange) {
    console.log('NO MATERIAL CHANGE');
  } else {
    if (report.signals.firstPublicIssue) console.log('- FIRST PUBLIC ISSUE DETECTED');
    if (report.signals.starsIncreased) console.log(`- Stars increased by ${signed(report.deltaFromBaseline.community.stars)}`);
    if (report.signals.forksIncreased) console.log(`- Forks increased by ${signed(report.deltaFromBaseline.community.forks)}`);
    for (const item of report.signals.newExternalReferrers) {
      console.log(`- New external referrer: ${item.referrer} (${item.count} views / ${item.uniques} uniques)`);
    }
  }
  console.log('');
  console.log('Top referrers');
  const baselineRefs = referrerMap(baseline.topReferrers);
  for (const item of current.topReferrers.slice(0, 10)) {
    const before = baselineRefs.get(item.referrer) || { count: 0, uniques: 0 };
    console.log(`- ${item.referrer}: ${item.count} views / ${item.uniques} uniques (window delta ${signed(delta(item.count, before.count))} / ${signed(delta(item.uniques, before.uniques))})`);
  }
  console.log('');
  console.log('Popular paths');
  for (const item of current.popularPaths.slice(0, 10)) {
    console.log(`- ${item.path}: ${item.count} views / ${item.uniques} uniques`);
  }
}

try {
  main();
} catch (error) {
  console.error(`GitHub traffic report failed: ${error.message}`);
  process.exit(1);
}
