


# Worklog
## 20250719
1. [x] configをprivateとcommonで分離
2. [ ] ~~common-utilでmenuのIDの共通処理を作る~~ →できない
3. [ ] ~~最初だけは全データを一括で渡してしまう（おそらくそのほうが早い）~~ →重くなりそうなのでやっぱりやめる
4. [ ] そもそものMealPlanのデータ構造
   1. [x] SpreadSheetはテーブルで一旦そのまま持ってきている。　→そのまま
      1. [ ] ~~案1：{url, memo} = data[date][type][menu]　→ Editがしにくくなるので却下~~
      2. [x] 案2: CreatedTimeをIDとする。確かにこれしかない気がする。
   2. [ ] MealPlanServiceの中で変換する
      1. [ ] {date, type, menu, memo} = meal_plan[id]
5. [ ] 献立のdeleteがうまくいかないときがあるデバッグ
   1. [ ] UIにはIDだけ登録する。そこから処理をするようにする。
      1. [ ] DeleteButton → IDで関数コール → IDを使って中身のデータにアクセス（データはMealPlanServiceが保持すべき）
6. [ ] Appがデータを扱っているのを修正
7. [ ] MealPlanServiceに分離したい
