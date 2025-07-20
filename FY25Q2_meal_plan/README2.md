# 外部仕様

## 概略

### 週切り替えの考え方

- 献立は（土）日月火水木金で表示してほしい
- 買い出しはそれに準拠したものがあればよい
- TBD: TODOの考えはちょっと違って、月火水木金土日で考えたときに、次の日曜日までに

## 特徴

- すべての画面で定期同期ボタンを用意する。
  - 有効化された場合だけポーリングする。
  - 画面を離れたりしたら必ずポーリングを止める。
    - アイコンが「同期開始」に戻る
- バックグラウンドでの読み込みを駆使して、表示はできる限り早く行う（ユーザーの待ち時間を減らす）
- 今後のデータのことを考えると週跨ぎのデータは原則不要で良い。サーバーで選出して送る。

# 内部仕様


## class設計
- class: AppController
  - AppServiceとの中継
  - 関連するUIの操作

- class: AppService
  - 共通設定のデータ管理
    - config
    - 現在の週
    - 表示タイプ（献立、買い出し、TODO）

- class: MealPlanService
  - MealPlanのデータ管理を行う
  - ポーリングなどGASとの通信管理も行う
  - UIにタッチしない, UiHandlerから呼ばれる

- class: MealPlanController
  - MealPlan(献立)の表示
  - ユーザー操作に対して、MealPlanServiceとの中継

## 特徴
- IDの考え方
  - TODOはtoISOString()をIDとして使う
  - MealPlanはdate, type, menuをもってIDとする
    - localでどうやってdeleteを管理するか？
      - Deleted Listを作る
    - やはりIDがないと厳しい。ので、同じく、toISOString()をIDとして使う

## ケーススタディー

### 最初に開いたとき
1. AppControllerのinitialize
   1. AppServiceをコールして週、表示タイプの決定
   2. AppiUiHandlerがxxxxUiHandlerをコール
      1. xxxxUiHandlerがxxxxServiceを使ってデータを
   3. （表示しない表示タイプに対して）AppUiHandlerがyyyyUiHandlerにデータ非同期取得を依頼
      1. yyyyUiHandlerが先んじたデータ取得
   
2. 

### 週の変更
1. 人が週を変更
2. AppControllerがキャッチ
   1. AppServiceをコールして週の設定変更
   2. AppControllerrがxxxxControllerをコールして表示の更新？
      1. xxxxControllerが表示を更新


# Tips
## WeekDataの構造

```javascript
const meals = weekData[date][type];
```

