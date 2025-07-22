function testUpdateMealMenuForApp() {
  const new_menu = {
    date: "2025-07-23",
    type: "昼",
    menu: "update menu2",
    url: "", 
    memo: "updated memo2",
    id: "2025-07-22T11:15:32.027Z"
  }
  updateMealMenuForApp(new_menu);
}