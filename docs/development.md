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
  - `injected/`
    - `network-main.ts`: 即時購入クリック時に対象1件を取得するMAIN world entry
    - `trade-api-adapter.ts`: `/api/trade2/fetch/` のレスポンス解析
    - `network-message.ts`, `types.ts`: 取得結果の型と `window.postMessage`
  - `content/`
    - `index.ts`: trustedクリックの検出と取得結果を処理するcontent script entry
    - `network-message.ts`: 取得結果のruntime validation
    - `item-cache.ts`: item ID / result ID相関、上限、TTLを管理するタブ内キャッシュ
    - `trade-page-adapter.ts`: 文言に依存しない即時購入クリックのDOM相関
  - `purchase/`
    - `candidate.ts`, `types.ts`: 購入候補メッセージの検証とpendingレコード生成
    - `repository.ts`: 購入候補専用IndexedDBの同一transaction upsert
    - `background-handler.ts`: 候補保存とpending件数badge更新
    - `messages.ts`, `status.ts`: 履歴操作メッセージの検証と手動状態遷移
    - `export.ts`: 購入履歴のCSV・JSON生成
  - `purchase-history.ts`: 購入履歴の絞り込み、手動確定、削除、出力画面
- `public/`: 静的アセット
  - `manifest.json`
  - `popup.html`, `options.html`
  - `purchase-history.html`, `purchase-history.css`
  - `popup.css`, `options.css`
  - `tokens.css`: 全画面共通の色、フォント、角丸、フォーカス、アイテム詳細色
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
- `npm run test:unit`
  TypeScriptをビルドして、Trade API parserのNode unit testを実行
- `npm run build`  
  Viteで `dist/` を生成
- `npm run test:e2e`  
  Playwright E2E
- `npm run test:e2e:extension`  
  拡張E2E（optionsのバックアップ出力、popupのリーグ読込/言語切替）

`test:e2e:*` は `dist/` を拡張として読み込むため、実行前に `npm run build` が必要です。

## 5. ビルドの考え方

- エントリは `src/popup.ts`, `src/options.ts`, `src/background.ts`,
  `src/injected/network-main.ts`, `src/content/index.ts`
- Viteが `public/` をコピーし、出力を `dist/` にまとめる
- `manifest.json` は `public/` を編集して管理する

`MAIN` world の `network-main.js` はtrustedな即時購入クリックから要求された場合だけ、
`/api/trade2/fetch/{id}` で対象1件を取得します。サイトのfetchやXHRは受動監視せず、
`window.fetch` と `XMLHttpRequest.prototype` を変更しません。取得した `item` は `rawItem` として
加工せず保持し、`window.postMessage` でISOLATED worldへ通知します。
リクエスト形式、レスポンス最小構造、ソート時の呼び出し、認証情報の安全境界は
[Trade2 fetch API仕様](./trade2-fetch-api-spec.md)を参照してください。

`content.js` はISOLATED worldで `event.source`、origin、channel、payloadを検証し、
検証済みitemだけをタブ内メモリへ保持します。取得結果はitem IDとresult IDで参照でき、
最大1,000件、TTL 30分です。診断ログには受信件数だけを出力します。
world間メッセージはJSON文字列として送り、他のページscriptや拡張機能がobject payloadを
途中で変更できないようにします。受信側はJSON parse後も従来どおりruntime validationを行います。

Backgroundは検証済みの `purchase/candidate` メッセージを受けると、販売履歴DBとは
独立した `poe2-purchase-history` DBの `purchases` storeへpendingレコードをupsertします。
同一アイテムの再登録は同じreadwrite transaction内で既存レコードへ統合します。
`purchased` は再登録でpendingへ戻しません。保存後はpending件数をbadgeへ
反映し、100件以上は `99+` と表示します。

Optionsのバックアップ・復元は`chrome.storage.local`、`poe2-trade-history-*`の販売履歴DB、
`poe2-purchase-history`の購入履歴DBを一つのJSONへ保存・復元します。

2026-08-11の英語・日本語実DOM調査では、即時購入の検索結果行が `.row[data-id]`、
操作ボタンが `button.direct-btn`、Gold手数料が `[data-field="fee"]` でした。通常連絡の
Direct Whisperも同じbutton classを使うため、表示文言やclass単独では判定せず、feeを
含む行だけを即時購入操作として扱います。英語は `Travel to Hideout`、日本語は
`隠れ家に移動する` ですが、これらの文言は判定に使用しません。`data-id` の意味も
item ID/result IDのどちらかに決め打ちせず、取得結果を両方のキーで照合します。

クリック後は最大15秒だけ取得結果を待ち、後続batchで照合します。ユーザーのtrustedクリックは
windowのcapture段階で受け取るため、document以下で別拡張機能がイベント伝播を止めても
トレード操作を検出できます。そのうえで、ユーザーのtrustedクリック時に
行のIDと現在URLのsearch IDを検証できた場合だけ、公式fetch APIでその1件を取得します。
DOMからitemを再構築せず、取得結果はruntime validationを通します。
ページスクリプトによる合成クリックは候補として扱いません。
復元では初期化時に取得したfetch参照を使い、他の拡張機能が後から`window.fetch`を上書きしても
影響を受けにくくします。取得レスポンスはその場で直接解析します。本拡張はfetch wrapperを設置せず、
先行・後続拡張が追加した`debounce`などの独自プロパティにも触れません。
購入結果APIは購入完了の根拠にせず、本拡張では監視しません。

購入フローの設計原則は[購入履歴の手動確定設計](./purchase-history-design.md)を参照してください。
自動処理の終点はpending候補の追加です。購入済みへの確定と、購入しなかった候補の削除は
購入履歴画面でユーザーが手動実行します。保存状態はpendingとpurchasedの2種類だけです。

Phase 4では既存の販売履歴画面にpending件数、直近5件、購入履歴ページへの導線を追加し、
購入履歴の本体は `purchase-history.html` へ分離しています。購入履歴ページでは状態・名称・
リーグ・候補登録日の絞り込み、購入済みへの手動確定、
販売履歴と共通のアイテム詳細、元検索URL、1件削除・全削除、
CSV・JSON出力を提供します。詳細表示はMod配列の文字列要素と`description`を持つobject要素の
両方を正規化し、APIレスポンス形式によらず同じレンダラーで表示します。
`purchased` は手動操作でもpendingへ戻せません。状態更新と削除後はBackgroundでpending件数を
再計算し、badgeへ反映します。CSVは数式として解釈される先頭文字を無害化します。
購入履歴の絞り込み条件（状態、アイテム名、リーグ、開始日、終了日）は
`purchaseHistoryFilters`として`chrome.storage.local`に保存し、再表示時に復元します。

## 6. リーグ取得

- popupのリーグ一覧は `api/trade2/data/leagues` のJSONから取得する
- レスポンスの `result` から `realm` が未指定または `poe2` のリーグだけを表示する
- `trade2/history` のHTML解析は使用しない

## 7. 履歴APIスロットル

- `updateHistory` メッセージは `requestSource` で `user` / `automatic` を区別する
- popupの更新ボタンなどユーザー操作が契機の履歴取得はスロットルしない
- `requestSource` が未指定または `automatic` の履歴取得は、直近の履歴API呼び出しから1分未満なら制限する
