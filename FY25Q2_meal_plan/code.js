// Code.gs
function doGet() {
  return HtmlService.createHtmlOutputFromFile('form');
}

function submitMenu(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  sheet.appendRow([
    data.date,
    data.category,
    data.menu,
    data.ingredients,
    new Date()
  ]);
  return '登録しました';
}

function getMenusForWeek(startDate, endDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  const data = sheet.getDataRange().getValues();

  const start = new Date(startDate);
  const end = new Date(endDate);

  const menus = data.slice(1).filter(row => {
    const rowDate = new Date(row[0]);
    return rowDate >= start && rowDate <= end;
  }).map(row => ({
    date: row[0],
    category: row[1],
    menu: row[2],
    ingredients: row[3],
    timestamp: row[4]
  }));

  return menus;
}