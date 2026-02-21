# 開発ドキュメント

このドキュメントは開発者向け情報（環境構築、ビルド、検証、構成）をまとめたものです。

## 1. 開発方針

- ローカル環境を汚さないため、Dev Container利用を推奨
- ビルドは Vite (`npm run build`) を使用
- TypeScript は `strict` + `noImplicitAny` で運用

## 2. ディレクトリ構成

- `src/`: アプリソース
  - `background.ts`
  - `options.ts`
  - `shared.ts`
  - `i18n.ts`
  - `popup.ts`
  - `popup/`
    - `app.ts`
    - `types.ts`
    - `dom.ts`
    - `state.ts`
    - `history-service.ts`
    - `detail-renderer.ts`
    - `table-renderer.ts`
    - `chart-service.ts`
    - `formatters.ts`
- `public/`: 静的アセット
  - `manifest.json`
  - `popup.html`, `options.html`
  - `popup.css`, `options.css`
  - `icons/`, `_locales/`, `chart.umd.min.js`
- `dist/`: ビルド成果物（Chromeに読み込む先）

## 3. セットアップ

### 3.1 通常環境

1. `npm ci`
2. `npm run build`
3. Chromeで `chrome://extensions/` を開く
4. デベロッパーモードをON
5. 「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択

### 3.2 Dev Container

1. Docker Desktop を起動
2. VS Code / Cursor でリポジトリを開く
3. 「Reopen in Container」を実行
4. コンテナ内で `npm ci` を実行

## 4. 開発コマンド

- `npm run lint`  
  ESLint + Stylelint + TypeScript typecheck + Prettier check
- `npm run typecheck`  
  TypeScript型チェックのみ
- `npm run build`  
  Viteで `dist/` を生成
- `npm run test:e2e`  
  Playwright E2E
- `npm run test:e2e:extension`  
  拡張E2E（optionsのバックアップ出力、popupのリーグ読込/言語切替）

`test:e2e:*` は `dist/` を拡張として読み込むため、実行前に `npm run build` が必要です。

## 5. ビルドの考え方

- エントリは `src/popup.ts`, `src/options.ts`, `src/background.ts`
- Viteが `public/` をコピーし、出力を `dist/` にまとめる
- `manifest.json` は `public/` を編集して管理する
