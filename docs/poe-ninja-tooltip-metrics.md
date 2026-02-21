# poe.ninja ツールチップ定量表（PoE2 Builds）

## 1. 計測対象
- 対象ページ: `https://poe.ninja/poe2/builds/vaal/character/AsmodeusPOE-0579/Asmo_CarryDeluxe?i=0&search=class%3DBlood%2BMage`
- 計測日: 2026-02-21 (JST)
- 計測方法: Chrome DevTools MCP の `getComputedStyle` / `getBoundingClientRect`

## 2. 外形寸法
| 項目 | 計測値 |
|---|---:|
| ツールチップ外枠（role=tooltip）幅 | 380px |
| カード本体（article）幅 | 378px |
| 高さ（14サンプル）最小 | 288px |
| 高さ（14サンプル）中央値 | 521px |
| 高さ（14サンプル）平均 | 523px |
| 高さ（14サンプル）最大 | 884px |

## 3. レイアウト定量（主要）
| 部位 | プロパティ | 値 |
|---|---|---|
| カード本体 | border-radius | 3.75px |
| カード本体 | border | 1px solid (レアリティ色 75% alpha) |
| カード本体 | box-shadow | `0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)` |
| ヘッダー | padding | 7.5px 7.5px |
| ヘッダー | 背景 | レアリティ色の 12.5% alpha |
| 本文ラッパ | padding-top / bottom | 7.5px / 7.5px |
| セクション間隔 | margin-top | 3.75px |
| ピンボタン | size | 15px x 15px |
| ピンボタン | corner | `rounded-bl + rounded-tr`（右上/左下のみ） |

## 4. タイポグラフィ
| 項目 | 値 |
|---|---|
| 本文 font-size / line-height | 15px / 21px |
| タイトル font-size / line-height | 16.875px / 21.0938px |
| タイトル weight | 700 |
| タイトル align | center |

## 5. 色トークン（観測頻度ベース）
| 用途 | 色 |
|---|---|
| 通常本文（説明・ラベル） | `rgb(123, 135, 147)` |
| モッド主文（青系） | `rgb(138, 138, 255)` |
| 強調白 | `rgb(245, 247, 250)` |
| 通常タイトル（Rare系） | `rgb(255, 255, 117)` |
| Uniqueタイトル | `rgb(177, 98, 37)` |
| 引用/フレーバー | `rgb(177, 98, 37)` |
| Corrupted等の警告語 | `rgb(173, 52, 64)` |

## 6. レアリティ連動トークン
- タイトル色とカード上辺ボーダー色は同系色で連動
- ヘッダー背景はタイトル色の薄色（約 12.5% alpha）
- 上辺ボーダーは同色の約 75% alpha

## 7. 実装向け最小トークンセット
```css
:root {
  --tt-width: 378px;
  --tt-radius: 3.75px;
  --tt-body-fs: 15px;
  --tt-body-lh: 21px;
  --tt-title-fs: 16.875px;
  --tt-title-lh: 21.0938px;
  --tt-header-pad: 7.5px;
  --tt-section-gap: 3.75px;

  --tt-bg: color-mix(in oklab, #131a20 95%, transparent);
  --tt-text-muted: rgb(123, 135, 147);
  --tt-text-main: rgb(245, 247, 250);
  --tt-text-mod-blue: rgb(138, 138, 255);
  --tt-title-rare: rgb(255, 255, 117);
  --tt-title-unique: rgb(177, 98, 37);
  --tt-text-corrupted: rgb(173, 52, 64);
}
```

## 8. 補足
- `role="tooltip"` 自体は透明で、見た目の本体は内側の `article.bg-coolgrey-1000/95`。
- ツールチップ内容はアイテム種別ごとに高さのみ大きく変動し、横幅は固定に近い。
- 実装時は「固定幅 + 可変高 + セクション縦積み」で再現しやすい。
