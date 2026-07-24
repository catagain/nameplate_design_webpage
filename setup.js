#!/usr/bin/env node

/**
 * 會議桌上名牌管理系統 — 跨平台環境設定腳本
 *
 * 執行步驟:
 *   1. 檢查 Node.js 版本 (>= 18)
 *   2. 執行 npm install 安裝相依套件
 *   3. 若 .env 不存在，從 .env.example 複製
 *   4. 確認 uploads/ 目錄存在
 *
 * 支援: Windows / Linux / macOS
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_NODE_MAJOR = 18;

// ===== Helper =====

function color(message, code) {
  if (process.stdout.isTTY && process.platform !== 'win32') {
    return `\x1b[${code}m${message}\x1b[0m`;
  }
  return message;
}

function green(message) { return color(message, 32); }
function yellow(message) { return color(message, 33); }
function red(message) { return color(message, 31); }

function info(msg) { console.log(`[INFO] ${msg}`); }
function ok(msg) { console.log(`[${green('OK')}] ${msg}`); }
function warn(msg) { console.log(`[${yellow('WARN')}] ${msg}`); }
function fail(msg) { console.log(`[${red('FAIL')}] ${msg}`); }

// ===== Steps =====

function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);

  if (Number.isNaN(major)) {
    fail(`無法解析 Node.js 版本: ${version}`);
    process.exit(1);
  }

  if (major < REQUIRED_NODE_MAJOR) {
    fail(`Node.js ${REQUIRED_NODE_MAJOR}+ 為必要，目前版本: ${version}`);
    console.log(`  請至 https://nodejs.org/ 下載安裝 Node.js ${REQUIRED_NODE_MAJOR}+`);
    process.exit(1);
  }

  ok(`Node.js ${version}`);
}

function runNpmInstall() {
  info('安裝相依套件...');

  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    ok('npm install 完成');
  } catch (error) {
    fail('npm install 失敗');
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

function ensureEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');

  if (fs.existsSync(envPath)) {
    ok('.env 已存在');
    return;
  }

  if (!fs.existsSync(envExamplePath)) {
    warn('.env.example 不存在，跳過 .env 建立');
    return;
  }

  try {
    fs.copyFileSync(envExamplePath, envPath);
    ok('已從 .env.example 建立 .env');
    info('請編輯 .env 檔案以符合實際環境設定（如 PORT、HOST 等）');
  } catch (error) {
    fail(`建立 .env 失敗: ${error.message}`);
  }
}

function ensureUploadsDir() {
  const uploadsPath = path.join(__dirname, 'uploads');

  if (fs.existsSync(uploadsPath)) {
    ok('uploads/ 目錄已存在');
    return;
  }

  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
    ok('已建立 uploads/ 目錄');
  } catch (error) {
    fail(`建立 uploads/ 目錄失敗: ${error.message}`);
  }
}

// ===== Main =====

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  會議桌上名牌管理系統 — 環境設定        ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

checkNodeVersion();
console.log('');

info('步驟 1/3: 安裝相依套件...');
runNpmInstall();
console.log('');

info('步驟 2/3: 建立環境設定檔...');
ensureEnvFile();
console.log('');

info('步驟 3/3: 確認資料目錄...');
ensureUploadsDir();
console.log('');

console.log('══════════════════════════════════════════');
ok('環境設定完成！');
console.log('');
console.log('  啟動服務:');
console.log('    npm start');
console.log('    或執行對應的啟動腳本 (start-nameplate.bat / start-nameplate.sh)');
console.log('');
