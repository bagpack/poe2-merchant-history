# poe.ninja 装備ホバーツールチップ調査メモ

## 1. 調査対象
- URL: `https://poe.ninja/poe2/builds/vaal/character/AsmodeusPOE-0579/Asmo_CarryDeluxe?i=0&search=class%3DBlood%2BMage`
- 目的: 装備ホバー時ツールチップを完全再現するため、UI構造とAPIデータの対応関係を特定する
- 取得日: 2026-02-21 (JST)

## 2. スクリーンショット一覧
保存先: `docs/images/poe-ninja-tooltip`

- `00_full.png`: ページ全体（装備欄の基準）
- `01_weapon_hover.png`: Weapon ホバー
- `02_helm_hover.png`: Helm ホバー
- `03_bodyarmour_hover.png`: BodyArmour ホバー
- `04_gloves_hover.png`: Gloves ホバー
- `05_boots_hover.png`: Boots ホバー
- `06_socket_hover.png`: socketSlot ホバー
- `08_slot0_tooltip_only.png`: slot-0 ツールチップ単体
- `09_slot0_hover_viewport.png`: slot-0 ホバー時ビューポート
- `10_helm_tooltip_only.png`: Helm ツールチップ単体
- `11_helm_hover_viewport.png`: Helm ホバー時ビューポート
- `12_bodyarmour_tooltip_only.png`: Body Armour ツールチップ単体
- `13_bodyarmour_hover_viewport.png`: Body Armour ホバー時ビューポート
- `14_gloves_tooltip_only.png`: Gloves ツールチップ単体
- `15_gloves_hover_viewport.png`: Gloves ホバー時ビューポート
- `16_flask_tooltip_only.png`: Flask ツールチップ単体
- `17_flask_hover_viewport.png`: Flask ホバー時ビューポート
- `18_ring_tooltip_only.png`: Ring ツールチップ単体
- `19_ring_hover_viewport.png`: Ring ホバー時ビューポート
- `20_belt_tooltip_only_i1.png`: `i=1` Belt ツールチップ単体
- `21_belt_hover_viewport_i1.png`: `i=1` Belt ホバー時ビューポート
- `22_helm_tooltip_only_i1.png`: `i=1` Helm ツールチップ単体
- `23_helm_hover_viewport_i1.png`: `i=1` Helm ホバー時ビューポート
- `24_ring_tooltip_only_i1.png`: `i=1` Ring ツールチップ単体
- `25_ring_hover_viewport_i1.png`: `i=1` Ring ホバー時ビューポート
- `26_gloves_tooltip_only_i1.png`: `i=1` Gloves ツールチップ単体
- `27_gloves_hover_viewport_i1.png`: `i=1` Gloves ホバー時ビューポート
- `28_flask_tooltip_only_i1.png`: `i=1` Flask ツールチップ単体
- `29_flask_hover_viewport_i1.png`: `i=1` Flask ホバー時ビューポート
- `30_fullpage_with_tooltip_i1.png`: `i=1` ページ全体（フルページ）
- `31_boots_tooltip_only_i0.png`: `i=0` Boots本体ツールチップ単体
- `32_boots_hover_viewport_i0.png`: `i=0` Boots本体ホバー時ビューポート
- `33_weapon_tooltip_only_i0.png`: `i=0` Weapon本体ツールチップ単体
- `34_amulet_tooltip_only_i0.png`: `i=0` Amulet本体ツールチップ単体
- `35_ring_rare_tooltip_only_i0.png`: `i=0` Rare Ring本体ツールチップ単体
- `36_belt_tooltip_only_i0.png`: `i=0` Belt本体ツールチップ単体
- `37_multi_tooltips_viewport_i0.png`: `i=0` 複数ツールチップ同時表示（ビューポート）
- `38_multi_tooltips_fullpage_i0.png`: `i=0` 複数ツールチップ同時表示（フルページ）

### 2.1 取得手順（欠け防止）
- ビューポート画像は `hover(slot)` 後に `take_screenshot()` を実行
- ツールチップ単体は `take_screenshot(uid=<tooltip>)` で直接要素キャプチャ
- この方式で「画面外にはみ出すことによる欠け」を回避可能

### 2.2 観測された制約
- `equip-slot-7`（Boots 本体のスロット）では Rune のツールチップが優先表示される
- マウス座標をスロット内で変更しても Rune ツールチップが継続し、Boots本体の単体ホバー取得は未達
- そのため Boots 本体の再現検証は、別ビルドまたは Rune 未装着キャラでの追加採取が必要

### 2.3 Boots本体の取得補足（2026-02-21）
- `i=0` ページでは Boots 本体（`Agony Urge Bound Sandals`）のツールチップを取得できた
- DOM上のスロットボタン参照が不安定なため、座標ベースで `mousemove` を発火してツールチップ表示を安定化

### 2.4 フルセット補完（2026-02-21）
- `i=0` で Weapon / Amulet / Rare Ring / Belt のツールチップ単体画像を追加取得した
- 同時に複数ツールチップを開いた状態のビューポート/フルページ画像も保存した

## 3. ページ表示時に呼ばれる主要API

### 3.1 インデックス状態
- API: `GET /poe2/api/data/index-state`
- 役割:
  - リーグ情報（`buildLeagues`）
  - スナップショット情報（`snapshotVersions`）
- ツールチップ再現で重要な点:
  - `snapshotVersions[].version` がキャラクター詳細APIのバージョンセグメントに使われる
  - 今回の対象は `1802-20260220-36790`

### 3.2 キャラクター詳細
- API: `GET /poe2/api/builds/{version}/character?...`
- 今回の実URL:
  - `/poe2/api/builds/1802-20260220-36790/character?account=AsmodeusPOE-0579&name=Asmo_CarryDeluxe&overview=fate-of-the-vaal`
- 役割:
  - 装備、スキル、防御統計などツールチップに必要な実データ本体を返す
- 主なレスポンスキー:
  - `items`, `skills`, `defensiveStats`, `jewels`, `flasks` など

## 4. APIデータと装備表示の対応

### 4.1 装備スロット対応（`items[].itemData.inventoryId`）
`itemSlot` 数値だけでも識別できるが、再現実装では `inventoryId` を使う方が安全。

- `Weapon` (itemSlot: 7)
- `Weapon2` (itemSlot: 15)
- `Helm` (itemSlot: 1)
- `BodyArmour` (itemSlot: 3)
- `Gloves` (itemSlot: 2)
- `Boots` (itemSlot: 5)
- `Amulet` (itemSlot: 4)
- `Ring` (itemSlot: 8)
- `Ring2` (itemSlot: 9)
- `Belt` (itemSlot: 11)

### 4.2 ツールチップ描画に使われる主要フィールド（`items[].itemData`）
- ヘッダー:
  - `name`, `typeLine`, `rarity/frameType`
- 基本情報:
  - `ilvl`, `baseType`, `icon`, `w`, `h`
- ステータス行:
  - `implicitMods`, `explicitMods`, `runeMods`, `desecratedMods`, `mutatedMods`
- 状態フラグ:
  - `corrupted`, `doubleCorrupted`, `desecrated`, `identified`, `fractured`, `synthesised`, `duplicated`
- ソケット関連:
  - `sockets`, `socketedItems`

## 5. ツールチップDOM構造（観測）

ホバー時のツールチップは `role="tooltip"` 配下に描画され、本文は `article` で構成される。

- ルート:
  - `article.bg-coolgrey-1000/95 ...`
- ヘッダー:
  - `header` 内 `h1` に `name` と `typeLine`
  - レアリティ色は CSS variable (`--item-rare`, `--item-unique` など) で制御
- 本文:
  - `_item-body_*` 配下に複数 `section`
  - セクション順は概ね
    1. 基本プロパティ（装備種別、Quality、防御値、Item Level）
    2. Requirements
    3. エンチャント/特殊行
    4. Explicit/その他Mod群
    5. アイテム画像

## 6. 再現実装の要点
- データソースは `character` APIの `items[].itemData` を一次情報にする
- スロット対応は `inventoryId` ベースで画面グリッドへ配置する
- ツールチップは「ヘッダー + section分割 + Mod種別ごとの色分け」で再構成する
- レアリティ色は `rarity/frameType` からクラス変換して適用する
- ソケット内アイテム表示は `socketedItems` を別レイヤーとして扱う

## 7. 収集した生データ
- `docs/poe-ninja-index-state.json`
- `docs/poe-ninja-character.json`

## 8. UI定量表
- `docs/poe-ninja-tooltip-metrics.md` に、実装に使う寸法・余白・色・タイポの定量値を整理
