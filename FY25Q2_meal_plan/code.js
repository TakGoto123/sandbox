function doGet() {
  const sheetName = 'data1';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const template = HtmlService.createTemplateFromFile('page');
  template.headers = headers;
  template.data = data;  // 全データそのまま渡す
  return template.evaluate().setTitle('献立一覧');
}

// function doGet(e) {
//   Logger.log("hogehoge01")
//   try {
//     return handleRequest(e);
//   } catch (err) {
//     Logger.log(err);
//     return HtmlService.createHtmlOutput('<h1>エラー発生</h1><pre>' + err.message + '</pre>');
//   }
// }

// function handleRequest(e) {
//   const sheetName = 'data1';
//   const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

//   if (!sheet) throw new Error(`シート "${sheetName}" が見つかりませんでした`);

//   const data = sheet.getDataRange().getValues();
//   const headers = data.shift();

//   const weekStart = (e.parameter && isValidDate(e.parameter.week)) ? e.parameter.week : getDefaultWeekStart();
//   const weekDates = getWeekDates(weekStart);

//   // 【データを日付・区分でグループ化】
//   const map = {};
//   data.forEach(row => {
//     let [date, type, menu, memo] = row;
//     date = date instanceof Date ? Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd') : String(date).trim();
//     type = String(type).trim();

//     const key = date + '|' + type;
//     if (!map[key]) map[key] = [];
//     map[key].push({ menu, memo });
//   });

//   // 【日付・区分の順に並べ、空も埋める】
//   const displayData = [];
//   weekDates.forEach(date => {
//     ['弁当', '夜'].forEach(type => {
//       const key = date + '|' + type;
//       const menus = map[key] || [{ menu: '', memo: '' }]; // 無い場合は空1行
//       displayData.push({
//         date,
//         type,
//         menus,
//         rowspan: menus.length
//       });
//     });
//   });

//   const template = HtmlService.createTemplateFromFile('page');
//   template.headers = headers;
//   template.data = displayData;
//   template.weekStart = weekStart;
//   template.weekDisplay = formatWeekDisplay(weekStart);
//   template.dataCount = displayData.reduce((sum, record) => sum + record.menus.length, 0);  // 献立総数
//   return template.evaluate().setTitle('献立一覧');
// }

function getDefaultWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=日曜日
  const daysToSubtract = (dayOfWeek === 6) ? 0 : (dayOfWeek + 1) % 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysToSubtract);
  return Utilities.formatDate(saturday, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getWeekDates(weekStart) {
  const startDate = new Date(weekStart);
  const weekDates = [];
  for (let i = 2; i <= 6; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    weekDates.push(Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd'));
  }
  return weekDates;
}

function filterDataByWeek(data, weekDates) {
  return data.filter(row => {
    let dateStr = row[0];
    if (dateStr instanceof Date) {
      dateStr = Utilities.formatDate(dateStr, 'Asia/Tokyo', 'yyyy-MM-dd');
    } else {
      dateStr = String(dateStr).trim();
    }
    return weekDates.includes(dateStr);
  });
}

function formatWeekDisplay(weekStart) {
  const saturday = new Date(weekStart);
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  return `${monday.getFullYear()}年${monday.getMonth() + 1}月${monday.getDate()}日週`;
}

// yyyy-MM-dd 形式の簡単なバリデーション
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}

