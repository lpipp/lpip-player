// 构建可单测的 mpd-stats 产物：
// 1) 读取 src/main/mpd.ts 源码
// 2) electron / ./config 两处外部依赖替换为 stub（单测函数均为纯逻辑，零运行时依赖）
// 3) esbuild 转译为 ESM 落盘，供 test-playstats-unit.mjs 导入
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = '/home/lpipwei/Project/lpip-player/src/main/mpd.ts';
const OUT_DIR = '/tmp/lpip-playstats-build';
const TMP_SRC = OUT_DIR + '/mpd-stats.src.ts';
const OUT = OUT_DIR + '/mpd-stats.mjs';
const ESBUILD = '/home/lpipwei/Project/lpip-player/node_modules/.pnpm/node_modules/esbuild/bin/esbuild';

let code = readFileSync(SRC, 'utf-8');

// stub electron: `import { app } from 'electron'` -> 本地桩
code = code.replace(
  "import { app } from 'electron'",
  "const app = { getPath: (n) => (n === 'home' ? (process.env.HOME || '/tmp') : '/tmp') };"
);
// stub ./config: loadConfig 仅返回 mpd 主机端口（单测不触网）
code = code.replace(
  "import { loadConfig } from './config'",
  "const loadConfig = () => ({ mpd: { host: '127.0.0.1', port: 6600 } });"
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(TMP_SRC, code);
execFileSync(ESBUILD, [TMP_SRC, '--format=esm', '--platform=node', `--outfile=${OUT}`], { stdio: 'inherit' });
console.log('built', OUT);
