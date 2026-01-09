#!/usr/bin/env node

/**
 * 版本号同步脚本
 * 同时更新 tauri.conf.json, Cargo.toml, package.json 中的版本号
 *
 * 用法:
 *   pnpm version:bump 3.10.0
 *   pnpm version:bump patch   # 自动 +1 patch 版本
 *   pnpm version:bump minor   # 自动 +1 minor 版本
 *   pnpm version:bump major   # 自动 +1 major 版本
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// 需要更新版本号的文件
const FILES = {
  packageJson: resolve(ROOT_DIR, 'package.json'),
  tauriConf: resolve(ROOT_DIR, 'src-tauri/tauri.conf.json'),
  cargoToml: resolve(ROOT_DIR, 'src-tauri/Cargo.toml'),
};

/**
 * 解析 SemVer 版本号
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseSemVer(version) {
  // 移除可能的 -build 后缀（如 3.9.0-3）
  const cleanVersion = version.split('-')[0];
  const [major, minor, patch] = cleanVersion.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * 根据类型计算新版本号
 * @param {string} currentVersion
 * @param {string} bumpType
 * @returns {string}
 */
function calculateNewVersion(currentVersion, bumpType) {
  const { major, minor, patch } = parseSemVer(currentVersion);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      // 如果不是 major/minor/patch，视为直接指定的版本号
      return bumpType;
  }
}

/**
 * 验证版本号格式
 * @param {string} version
 * @returns {boolean}
 */
function isValidSemVer(version) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version);
}

/**
 * 获取当前版本号
 * @returns {string}
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  return packageJson.version;
}

/**
 * 更新 package.json
 * @param {string} newVersion
 */
function updatePackageJson(newVersion) {
  const content = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  const oldVersion = content.version;
  content.version = newVersion;
  writeFileSync(FILES.packageJson, JSON.stringify(content, null, 2) + '\n');
  console.log(`  package.json: ${oldVersion} -> ${newVersion}`);
}

/**
 * 更新 tauri.conf.json
 * @param {string} newVersion
 */
function updateTauriConf(newVersion) {
  const content = JSON.parse(readFileSync(FILES.tauriConf, 'utf-8'));
  const oldVersion = content.version;
  content.version = newVersion;
  writeFileSync(FILES.tauriConf, JSON.stringify(content, null, 2) + '\n');
  console.log(`  tauri.conf.json: ${oldVersion} -> ${newVersion}`);
}

/**
 * 更新 Cargo.toml
 * @param {string} newVersion
 */
function updateCargoToml(newVersion) {
  let content = readFileSync(FILES.cargoToml, 'utf-8');
  const versionRegex = /^version\s*=\s*"([^"]+)"/m;
  const match = content.match(versionRegex);
  const oldVersion = match ? match[1] : 'unknown';

  content = content.replace(versionRegex, `version = "${newVersion}"`);
  writeFileSync(FILES.cargoToml, content);
  console.log(`  Cargo.toml: ${oldVersion} -> ${newVersion}`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    const currentVersion = getCurrentVersion();
    console.log(`\n当前版本: ${currentVersion}\n`);
    console.log('用法:');
    console.log('  pnpm version:bump <version>  # 指定版本号，如 3.10.0');
    console.log('  pnpm version:bump patch      # 自动 +1 patch 版本');
    console.log('  pnpm version:bump minor      # 自动 +1 minor 版本');
    console.log('  pnpm version:bump major      # 自动 +1 major 版本');
    console.log('\n示例:');
    console.log(`  pnpm version:bump patch  =>  ${calculateNewVersion(currentVersion, 'patch')}`);
    console.log(`  pnpm version:bump minor  =>  ${calculateNewVersion(currentVersion, 'minor')}`);
    console.log(`  pnpm version:bump major  =>  ${calculateNewVersion(currentVersion, 'major')}`);
    process.exit(0);
  }

  const bumpType = args[0];
  const currentVersion = getCurrentVersion();
  const newVersion = calculateNewVersion(currentVersion, bumpType);

  // 验证新版本号
  if (!isValidSemVer(newVersion)) {
    console.error(`\n错误: 无效的版本号格式 "${newVersion}"`);
    console.error('版本号必须符合 SemVer 格式: MAJOR.MINOR.PATCH (如 3.10.0)');
    process.exit(1);
  }

  // 检查版本号是否变化
  if (newVersion === currentVersion) {
    console.log(`\n版本号未变化: ${currentVersion}`);
    process.exit(0);
  }

  console.log(`\n更新版本号: ${currentVersion} -> ${newVersion}\n`);

  try {
    updatePackageJson(newVersion);
    updateTauriConf(newVersion);
    updateCargoToml(newVersion);

    console.log('\n版本号更新完成!');
    console.log('\n下一步:');
    console.log('  1. 检查更改: git diff');
    console.log('  2. 提交更改: git add . && git commit -m "chore(release): bump version to ' + newVersion + '"');
    console.log('  3. 创建标签: git tag v' + newVersion);
    console.log('  4. 推送到远程: git push origin main && git push origin v' + newVersion);
  } catch (error) {
    console.error('\n更新版本号时出错:', error.message);
    process.exit(1);
  }
}

main();
