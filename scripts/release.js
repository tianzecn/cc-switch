#!/usr/bin/env node

/**
 * CC Switch 一键发布脚本
 *
 * 用法：
 *   node scripts/release.js          # 自动递增补丁版本 (3.9.0-4 → 3.9.0-5)
 *   node scripts/release.js 3.9.1    # 指定版本号
 *   node scripts/release.js patch    # 递增补丁版本 (3.9.0 → 3.9.1)
 *   node scripts/release.js minor    # 递增次版本 (3.9.0 → 3.10.0)
 *   node scripts/release.js major    # 递增主版本 (3.9.0 → 4.0.0)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: "utf-8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return "";
  }
}

function execSilent(command) {
  return exec(command, { silent: true, stdio: "pipe" }).trim();
}

// 读取当前版本号
function getCurrentVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(ROOT_DIR, "package.json"), "utf-8")
  );
  return packageJson.version;
}

// 解析版本号
function parseVersion(version) {
  // 处理预发布版本：3.9.0-4 → { major: 3, minor: 9, patch: 0, prerelease: 4 }
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/);
  if (!match) {
    throw new Error(`无效的版本号格式: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] ? parseInt(match[4]) : null,
  };
}

// 格式化版本号
function formatVersion(v) {
  if (v.prerelease !== null) {
    return `${v.major}.${v.minor}.${v.patch}-${v.prerelease}`;
  }
  return `${v.major}.${v.minor}.${v.patch}`;
}

// 计算新版本号
function calculateNewVersion(current, bump) {
  const v = parseVersion(current);

  switch (bump) {
    case "major":
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0, prerelease: null });
    case "minor":
      return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0, prerelease: null });
    case "patch":
      return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1, prerelease: null });
    case "prerelease":
    default:
      // 如果有预发布号，递增；否则添加 -1
      if (v.prerelease !== null) {
        return formatVersion({ ...v, prerelease: v.prerelease + 1 });
      } else {
        return formatVersion({ ...v, prerelease: 1 });
      }
  }
}

// 更新版本号文件
function updateVersionFiles(newVersion) {
  // 更新 package.json
  const packageJsonPath = join(ROOT_DIR, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  // 更新 tauri.conf.json
  const tauriConfigPath = join(ROOT_DIR, "src-tauri", "tauri.conf.json");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf-8"));
  tauriConfig.version = newVersion;
  writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n");

  return [packageJsonPath, tauriConfigPath];
}

// 检查是否有未提交的更改
function hasUncommittedChanges() {
  const status = execSilent("git status --porcelain");
  return status.length > 0;
}

// 检查是否已认证 gh
function checkGhAuth() {
  try {
    execSilent("gh auth status");
    return true;
  } catch {
    return false;
  }
}

// 询问用户确认
function askConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${colors.yellow}${question} (y/N): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// 主函数
async function main() {
  console.log();
  log("🚀 CC Switch 发布脚本", "bright");
  console.log("─".repeat(40));

  // 获取参数
  const arg = process.argv[2];
  const currentVersion = getCurrentVersion();
  let newVersion;

  // 计算新版本号
  if (!arg) {
    // 默认递增预发布版本
    newVersion = calculateNewVersion(currentVersion, "prerelease");
  } else if (["major", "minor", "patch", "prerelease"].includes(arg)) {
    newVersion = calculateNewVersion(currentVersion, arg);
  } else if (/^\d+\.\d+\.\d+(-\d+)?$/.test(arg)) {
    newVersion = arg;
  } else {
    logError(`无效的参数: ${arg}`);
    console.log();
    console.log("用法:");
    console.log("  node scripts/release.js          # 自动递增预发布版本");
    console.log("  node scripts/release.js 3.9.1    # 指定版本号");
    console.log("  node scripts/release.js patch    # 递增补丁版本");
    console.log("  node scripts/release.js minor    # 递增次版本");
    console.log("  node scripts/release.js major    # 递增主版本");
    process.exit(1);
  }

  // 显示版本变更
  console.log();
  log(`📦 当前版本: ${currentVersion}`, "blue");
  log(`📦 新版本:   ${newVersion}`, "green");
  console.log();

  // 检查未提交的更改
  if (hasUncommittedChanges()) {
    log("⚠️  检测到未提交的更改", "yellow");
    const status = execSilent("git status --short");
    console.log(status);
    console.log();

    const confirm = await askConfirm("是否将这些更改一起提交？");
    if (!confirm) {
      log("已取消发布", "yellow");
      process.exit(0);
    }
  }

  // 最终确认
  const confirmRelease = await askConfirm(
    `确认发布 v${newVersion}？这将触发 CI 构建并发布到 GitHub Releases`
  );
  if (!confirmRelease) {
    log("已取消发布", "yellow");
    process.exit(0);
  }

  console.log();
  log("开始发布流程...", "bright");
  console.log();

  try {
    // Step 1: 更新版本号
    logStep("1/6", "更新版本号文件...");
    updateVersionFiles(newVersion);
    logSuccess(`版本号已更新为 ${newVersion}`);

    // Step 2: 暂存所有更改
    logStep("2/6", "暂存更改...");
    exec("git add -A", { silent: true });
    logSuccess("已暂存所有更改");

    // Step 3: 创建提交
    logStep("3/6", "创建提交...");
    exec(`git commit -m "chore: release v${newVersion}"`, { silent: true });
    logSuccess("已创建提交");

    // Step 4: 推送代码
    logStep("4/6", "推送代码到远程...");
    exec("git push origin main", { silent: true });
    logSuccess("代码已推送");

    // Step 5: 创建 Tag
    logStep("5/6", "创建 Tag...");
    const tagName = `v${newVersion}`;
    exec(`git tag ${tagName}`, { silent: true });
    logSuccess(`已创建 Tag: ${tagName}`);

    // Step 6: 推送 Tag（触发 CI）
    logStep("6/6", "推送 Tag（触发 CI 构建）...");
    exec(`git push origin ${tagName}`, { silent: true });
    logSuccess("Tag 已推送，CI 构建已触发！");

    // 完成
    console.log();
    console.log("─".repeat(40));
    log("🎉 发布成功！", "green");
    console.log();
    log(`📦 版本: v${newVersion}`, "cyan");
    log(`🔗 GitHub Actions: https://github.com/tianzecn/cc-switch/actions`, "cyan");
    log(`🔗 Releases: https://github.com/tianzecn/cc-switch/releases`, "cyan");
    console.log();
    log("CI 构建大约需要 10-15 分钟，完成后可在 Releases 页面下载安装包。", "blue");
    console.log();
  } catch (error) {
    logError(`发布失败: ${error.message}`);
    process.exit(1);
  }
}

main();
