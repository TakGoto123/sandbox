/**
 * TODO管理システム - Google Apps Script
 * TODO-formシートからデータを取得・更新する機能
 */

// ========================================
// 定数定義
// ========================================
const TODO_CONFIG = {
  SHEET_NAME: 'TODO-form',
  COLUMNS: {
    TIMESTAMP: 0,
    TODO: 1,
    DATE: 2,
    DONE: 3
  },
  DATE_FORMAT: 'yyyy-MM-dd',
  TIMEZONE: 'Asia/Tokyo'
};

// ========================================
// TODOデータ取得機能
// ========================================

/**
 * 指定された週のTODOデータを取得
 * @param {string} weekStart - 週開始日（土曜日、yyyy-MM-dd形式）
 * @returns {Object} TODOデータ
 */
function getTodoDataForWeek(weekStart) {
  try {
    checkAccess(); // アクセス制御チェック
    
    const sheet = getSheet(TODO_CONFIG.SHEET_NAME);
    const rawData = sheet.getDataRange().getValues();
    
    if (rawData.length <= 1) {
      return {
        success: true,
        data: [],
        weekStart: weekStart,
        targetSunday: calculateTargetSunday(weekStart)
      };
    }
    
    // ヘッダーを除去
    const headers = rawData.shift();
    
    // 対象の日曜日を計算
    const targetSunday = calculateTargetSunday(weekStart);
    const oneWeekBefore = new Date(targetSunday);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
    
    Logger.log(`Week start: ${weekStart}`);
    Logger.log(`Target Sunday: ${formatDate(targetSunday)}`);
    Logger.log(`One week before: ${formatDate(oneWeekBefore)}`);
    
    // データをフィルタリング
    const filteredData = rawData
      .map((row, index) => normalizeToDoRow(row, index + 2)) // +2はヘッダー行とインデックス調整
      .filter(item => {
        if (!item || !item.date) return false;
        
        const itemDate = new Date(item.date);
        
        // 未完了のTODO: 対象日曜日まで
        if (!item.done) {
          return itemDate <= targetSunday;
        }
        
        // 完了済みのTODO: 一週間前から対象日曜日まで
        return itemDate >= oneWeekBefore && itemDate <= targetSunday;
      })
      .sort((a, b) => {
        // 日付順でソート
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
    
    Logger.log(`Filtered ${filteredData.length} TODO items`);
    
    return {
      success: true,
      data: filteredData,
      weekStart: weekStart,
      targetSunday: formatDate(targetSunday),
      oneWeekBefore: formatDate(oneWeekBefore)
    };
    
  } catch (error) {
    Logger.log('Error getting TODO data:', error.message);
    return {
      success: false,
      message: 'TODOデータの取得に失敗しました: ' + error.message,
      data: []
    };
  }
}

/**
 * TODOデータ行を正規化
 * @param {Array} row - 生データの行
 * @param {number} rowNumber - 行番号（スプレッドシート上の）
 * @returns {Object} 正規化されたTODOアイテム
 */
function normalizeToDoRow(row, rowNumber) {
  try {
    const [timestamp, todo, date, done] = row;
    
    if (!todo || !date) {
      return null;
    }
    
    return {
      rowNumber: rowNumber,
      timestamp: timestamp ? formatDate(timestamp) : '',
      todo: String(todo).trim(),
      date: formatDate(date),
      done: Boolean(done),
      id: `todo_${rowNumber}` // 一意のID
    };
  } catch (error) {
    Logger.log(`Error normalizing TODO row ${rowNumber}:`, error.message);
    return null;
  }
}

/**
 * 週開始日（土曜日）から対象の日曜日を計算
 * @param {string} weekStart - 週開始日（土曜日、yyyy-MM-dd形式）
 * @returns {Date} 対象の日曜日
 */
function calculateTargetSunday(weekStart) {
  const saturday = new Date(weekStart);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1); // 土曜日の次の日（日曜日）
  return sunday;
}

// ========================================
// TODOデータ更新機能
// ========================================

/**
 * TODOアイテムのDone状態を更新
 * @param {number} rowNumber - 行番号
 * @param {boolean} doneStatus - 新しいDone状態
 * @returns {Object} 更新結果
 */
function updateTodoDoneStatus(rowNumber, doneStatus) {
  try {
    checkAccess(); // アクセス制御チェック
    
    const sheet = getSheet(TODO_CONFIG.SHEET_NAME);
    
    // 行番号の妥当性チェック
    const lastRow = sheet.getLastRow();
    if (rowNumber < 2 || rowNumber > lastRow) {
      throw new Error(`無効な行番号: ${rowNumber}`);
    }
    
    // Done列（D列）を更新
    const doneCell = sheet.getRange(rowNumber, TODO_CONFIG.COLUMNS.DONE + 1);
    
    // チェックボックス形式を設定
    doneCell.setDataValidation(
      SpreadsheetApp.newDataValidation().requireCheckbox().build()
    );
    
    // 値を更新
    doneCell.setValue(Boolean(doneStatus));
    
    Logger.log(`Updated TODO row ${rowNumber}: done = ${doneStatus}`);
    
    return {
      success: true,
      message: 'TODO状態を更新しました',
      rowNumber: rowNumber,
      doneStatus: Boolean(doneStatus)
    };
    
  } catch (error) {
    Logger.log('Error updating TODO done status:', error.message);
    return {
      success: false,
      message: 'TODO状態の更新に失敗しました: ' + error.message
    };
  }
}

/**
 * 新しいTODOアイテムを追加
 * @param {string} todoText - TODOテキスト
 * @param {string} dueDate - 期限日（yyyy-MM-dd形式）
 * @returns {Object} 追加結果
 */
function addTodoItem(todoText, dueDate) {
  try {
    checkAccess(); // アクセス制御チェック
    
    const sheet = getSheet(TODO_CONFIG.SHEET_NAME);
    
    // 新しい行を追加
    const timestamp = new Date();
    const newRow = [
      timestamp,
      String(todoText).trim(),
      new Date(dueDate),
      false
    ];
    
    const lastRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(lastRow, 1, 1, 4);
    range.setValues([newRow]);
    
    // Done列にチェックボックスを設定
    const doneCell = sheet.getRange(lastRow, TODO_CONFIG.COLUMNS.DONE + 1);
    doneCell.setDataValidation(
      SpreadsheetApp.newDataValidation().requireCheckbox().build()
    );
    doneCell.setValue(false);
    
    Logger.log('Added new TODO item:', newRow);
    
    return {
      success: true,
      message: 'TODOアイテムを追加しました',
      rowNumber: lastRow,
      data: {
        timestamp: formatDate(timestamp),
        todo: String(todoText).trim(),
        date: formatDate(new Date(dueDate)),
        done: false
      }
    };
    
  } catch (error) {
    Logger.log('Error adding TODO item:', error.message);
    return {
      success: false,
      message: 'TODOアイテムの追加に失敗しました: ' + error.message
    };
  }
}

/**
 * TODOアイテムを削除
 * @param {number} rowNumber - 行番号
 * @returns {Object} 削除結果
 */
function deleteTodoItem(rowNumber) {
  try {
    checkAccess(); // アクセス制御チェック
    
    const sheet = getSheet(TODO_CONFIG.SHEET_NAME);
    
    // 行番号の妥当性チェック
    const lastRow = sheet.getLastRow();
    if (rowNumber < 2 || rowNumber > lastRow) {
      throw new Error(`無効な行番号: ${rowNumber}`);
    }
    
    // 行を削除
    sheet.deleteRow(rowNumber);
    
    Logger.log(`Deleted TODO row: ${rowNumber}`);
    
    return {
      success: true,
      message: 'TODOアイテムを削除しました',
      deletedRow: rowNumber
    };
    
  } catch (error) {
    Logger.log('Error deleting TODO item:', error.message);
    return {
      success: false,
      message: 'TODOアイテムの削除に失敗しました: ' + error.message
    };
  }
}

// ========================================
// 統合アプリ用関数
// ========================================

/**
 * 統合アプリ用のTODOデータ取得関数
 * @param {string} weekStart - 週開始日
 * @returns {Object} TODOデータ
 */
function getTodoDataForApp(weekStart) {
  try {
    return getTodoDataForWeek(weekStart);
  } catch (error) {
    Logger.log('Error in getTodoDataForApp:', error.message);
    throw error;
  }
}

/**
 * 統合アプリ用のTODO状態更新関数
 * @param {number} rowNumber - 行番号
 * @param {boolean} doneStatus - Done状態
 * @returns {Object} 更新結果
 */
function updateTodoForApp(rowNumber, doneStatus) {
  try {
    return updateTodoDoneStatus(rowNumber, doneStatus);
  } catch (error) {
    Logger.log('Error in updateTodoForApp:', error.message);
    throw error;
  }
}

/**
 * 統合アプリ用のTODO追加関数
 * @param {string} todoText - TODOテキスト
 * @param {string} dueDate - 期限日
 * @returns {Object} 追加結果
 */
function addTodoForApp(todoText, dueDate) {
  try {
    return addTodoItem(todoText, dueDate);
  } catch (error) {
    Logger.log('Error in addTodoForApp:', error.message);
    throw error;
  }
}

// ========================================
// テスト・デバッグ用関数
// ========================================

/**
 * テスト用関数 - TODOデータ取得のテスト
 */
function testGetTodoData() {
  Logger.log('=== TODO データ取得テスト開始 ===');
  
  try {
    // 現在の週の土曜日を計算
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToSaturday = (6 - dayOfWeek) % 7;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysToSaturday);
    const weekStart = formatDate(saturday);
    
    Logger.log(`テスト対象週: ${weekStart}`);
    
    const result = getTodoDataForWeek(weekStart);
    Logger.log('取得結果:', result);
    
    if (result.success) {
      Logger.log(`取得したTODO数: ${result.data.length}`);
      result.data.forEach((item, index) => {
        Logger.log(`TODO ${index + 1}:`, item);
      });
    }
    
  } catch (error) {
    Logger.log('テストエラー:', error.message);
  }
  
  Logger.log('=== TODO データ取得テスト終了 ===');
}

/**
 * テスト用関数 - TODO状態更新のテスト
 */
function testUpdateTodoStatus() {
  Logger.log('=== TODO 状態更新テスト開始 ===');
  
  try {
    // テスト用のTODOを追加
    const addResult = addTodoItem('テスト用TODO', '2025-07-20');
    Logger.log('追加結果:', addResult);
    
    if (addResult.success) {
      const rowNumber = addResult.rowNumber;
      
      // Done状態をtrueに更新
      const updateResult1 = updateTodoDoneStatus(rowNumber, true);
      Logger.log('更新結果1 (true):', updateResult1);
      
      // Done状態をfalseに戻す
      const updateResult2 = updateTodoDoneStatus(rowNumber, false);
      Logger.log('更新結果2 (false):', updateResult2);
      
      // テスト用TODOを削除
      const deleteResult = deleteTodoItem(rowNumber);
      Logger.log('削除結果:', deleteResult);
    }
    
  } catch (error) {
    Logger.log('テストエラー:', error.message);
  }
  
  Logger.log('=== TODO 状態更新テスト終了 ===');
}

/**
 * テスト用関数 - 日曜日計算のテスト
 */
function testCalculateTargetSunday() {
  Logger.log('=== 日曜日計算テスト開始 ===');
  
  const testWeeks = [
    '2025-07-12', // 土曜日
    '2025-07-19', // 土曜日
    '2025-07-26'  // 土曜日
  ];
  
  testWeeks.forEach(weekStart => {
    const targetSunday = calculateTargetSunday(weekStart);
    Logger.log(`${weekStart} (土) -> ${formatDate(targetSunday)} (日)`);
  });
  
  Logger.log('=== 日曜日計算テスト終了 ===');
}
