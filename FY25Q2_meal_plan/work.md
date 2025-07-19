


# Worklog
## 20250719
1. [x] configをprivateとcommonで分離
2. [ ] ~~common-utilでmenuのIDの共通処理を作る~~　できない
3. [ ] ~~最初だけは全データを一括で渡してしまう（おそらくそのほうが早い）~~　重くなりそうなのでやっぱりやめる
4. [ ] 献立のdeleteがうまくいかないときがあるデバッグ
   1. [ ] UIにはIDだけ登録する。そこから処理をするようにする。
      1. [ ] DeleteButton → IDで関数コール → IDを使って中身のデータにアクセス（データはMealPlanServiceが保持すべき）
5. [ ] Appがデータを扱っているのを修正
6. [ ] MealPlanServiceに分離したい
