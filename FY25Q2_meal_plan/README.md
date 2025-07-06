# 献立管理システム (Google Apps Script)

このプロジェクトは、Google Apps Scriptを使用した献立管理システムです。スプレッドシートのデータを読み取り、週単位で献立を表示するWebアプリケーションです。

## 📁 プロジェクト構成

```
FY25Q2_meal_plan/
├── 設定ファイル
│   ├── appsscript.json      # GASプロジェクト設定
│   ├── .clasp.json          # clasp設定ファイル
│   └── .clinerules          # Cline設定
├── サーバーサイド（server-*.gs）
│   ├── server-main.gs       # メインサーバーロジック（旧code.js）
│   ├── server-weekend.gs    # Weekend機能サーバーロジック（旧weekend.js）
│   └── server-gemini.gs     # Gemini API機能（旧summarize.js）
├── クライアントサイド（client-*.html）
│   ├── client-main.html     # メインHTMLテンプレート（旧main.html）
│   ├── client-layout.html   # レイアウト部分（旧layout.html）
│   ├── client-styles.html   # スタイルシート（旧css.html）
│   ├── client-modal.html    # モーダル統合（旧modal.html + modal-handler.html）
│   ├── client-meal.html     # 献立機能（旧meal-plan.html）
│   ├── client-weekend.html  # Weekend機能（旧weekend-manager.html）
│   ├── client-app.html      # アプリケーション制御（旧app-controller.html）
│   └── client-utils.html    # 共通ユーティリティ（旧common-utils.html）
└── ドキュメント
    ├── README.md            # このファイル
    └── SECURITY_SETUP.md    # セキュリティ設定
```

## 🚀 機能

- **週単位表示**: 月曜日から金曜日の献立を週単位で表示
- **週切り替え**: 前週・次週への簡単な切り替え
- **レスポンシブデザイン**: モバイルデバイスにも対応
- **エラーハンドリング**: 適切なエラー処理とユーザーフィードバック

## 📊 データ構造

スプレッドシートの「menu-schedule」シートに以下の形式でデータを格納：

| 日付 | 区分 | メニュー | メモ |
|------|------|----------|------|
| 2025-01-06 | 弁当 | チキン弁当 | 野菜多め |
| 2025-01-06 | 夜 | カレー | 辛口 |

## 🛠️ 技術仕様

### サーバーサイド (server-*.gs)
- **言語**: Google Apps Script (JavaScript)
- **主要機能**:
  - スプレッドシートからのデータ取得
  - データの正規化と検証
  - HTMLテンプレートの生成
  - エラーハンドリング
  - Weekend機能とGemini API統合

### フロントエンド (client-*.html)
- **言語**: HTML5, CSS3, JavaScript (ES6+)
- **アーキテクチャ**: クラスベースのモジュール設計
- **主要機能**:
  - 週単位でのデータ表示
  - インタラクティブな週切り替え
  - レスポンシブデザイン
  - モーダルベースの献立追加・削除
  - Weekend買い物リスト管理

## 🔧 設定

### CONFIG オブジェクト (code.js)
```javascript
const CONFIG = {
  SHEET_NAME: 'menu-schedule',           // データシート名
  MEAL_TYPES: ['弁当', '夜'],    // 食事区分
  DATE_FORMAT: 'yyyy-MM-dd',     // 日付フォーマット
  TIMEZONE: 'Asia/Tokyo',        // タイムゾーン
  WEEK_START_DAY: 6,             // 週開始日（土曜日）
  WORK_DAYS: [2, 3, 4, 5, 6]     // 表示する曜日（月〜金）
};
```

## 📝 開発・デプロイ

### 前提条件
- Google Apps Script プロジェクト
- Google スプレッドシート
- clasp CLI（オプション）

### デプロイ手順
1. Google Apps Script エディタでプロジェクトを開く
2. `code.js` と `page.html` をアップロード
3. Webアプリとしてデプロイ
4. 実行権限を設定

### clasp を使用する場合
```bash
# プロジェクトをプッシュ
clasp push

# デプロイ
clasp deploy
```

## 🧪 テスト

### サーバーサイドテスト
```javascript
// データ取得のテスト
testGetMealData();

// 日付関数のテスト
testDateFunctions();
```

### デバッグ
- ブラウザの開発者ツールでコンソールログを確認
- Google Apps Script エディタでサーバーサイドログを確認

## 🔄 リファクタリング内容

### Before (改善前)
- コメントアウトされた大量のコード
- 重複したロジック
- 長い関数と責任の分散
- エラーハンドリング不足
- モーダル処理がメインスクリプトに混在

### After (改善後)
- **モジュール化**: 機能ごとに関数を分離
- **設定の外部化**: CONFIG オブジェクトで設定を管理
- **エラーハンドリング**: 適切な例外処理とユーザーフィードバック
- **コードの可読性**: JSDoc コメントと明確な命名
- **保守性**: クラスベースの設計とテスト関数
- **モーダル処理の分離**: ModalHandlerクラスとして独立したファイルに分離

### 最新の改善 (2025年7月13日)
#### ファイル構成のリファクタリング
- **目的**: 可読性の向上と保守性の改善
- **変更内容**:
  - **命名規則の統一**: `server-*` と `client-*` プレフィックスによる明確な分類
  - **モーダル処理の統合**: `modal.html` と `modal-handler.html` を `client-modal.html` に統合
  - **非推奨ファイルの削除**: `scripts.html` の削除
  - **include文の更新**: 新しいファイル名に合わせた参照の修正
  - **ドキュメントの更新**: README.md の構成図とファイル説明を最新化

#### 構造の改善効果
- **可読性**: ファイルの役割が一目で分かる命名規則
- **保守性**: 機能別にファイルが整理され、修正箇所の特定が容易
- **一貫性**: GASの制約内で最大限の構造化を実現
- **拡張性**: 新機能追加時の命名規則が明確

## 📋 メンテナンス

### 定期的な確認事項
- [ ] スプレッドシートのデータ形式
- [ ] 日付の妥当性チェック
- [ ] エラーログの確認
- [ ] パフォーマンスの監視

### 拡張可能な機能
- データの編集機能
- 複数シートの対応
- 印刷機能
- データのエクスポート

## 📞 サポート

問題が発生した場合は、以下を確認してください：
1. スプレッドシートのアクセス権限
2. データの形式（日付、区分）
3. ブラウザのコンソールエラー
4. Google Apps Script の実行ログ

---

**更新日**: 2025年1月6日  
**バージョン**: 2.0.0 (リファクタリング版)
