function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TODO-form");
  const submittedRow = e.range.getRow();

  // === 1. 日付列の自動補完 ===
  const dateColIndex = 3; // C列（日付）
  const dateCell = sheet.getRange(submittedRow, dateColIndex);
  if (!dateCell.getValue()) {
    const nextSunday = getNextSundayOrToday();
    dateCell.setValue(nextSunday);
  }

  // === 2. チェックボックス（FALSE）を追加 ===
  const checkboxColIndex = 4; // D列（処理済みなど）
  const checkboxCell = sheet.getRange(submittedRow, checkboxColIndex);

  // チェックボックス形式を設定して FALSE にする
  checkboxCell.setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build()
  );
  checkboxCell.setValue(false);
}

// === 補助関数：日曜なら今日、それ以外なら次の日曜を返す ===
function getNextSundayOrToday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 日曜 = 0

  const result = new Date(today);
  if (dayOfWeek !== 0) {
    result.setDate(today.getDate() + (7 - dayOfWeek)); // 次の日曜
  }

  result.setHours(0, 0, 0, 0); // 時刻を00:00:00に
  return result;
}
