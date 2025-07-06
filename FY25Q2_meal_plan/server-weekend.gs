// ショッピングリスト管理クラス
class WeekendItems {
  /**
   * @param {string|Date} weekStartDate - 週開始日（土曜日）またはシート名
   */
  constructor(weekStartDate) {
    if (typeof weekStartDate === 'string') {
      // 日付文字列またはシート名が渡された場合
      if (weekStartDate.startsWith('weekend-')) {
        this.sheetName = weekStartDate;
      } else if (weekStartDate.includes('-')) {
        this.sheetName = `weekend-${this.formatDateForSheet(new Date(weekStartDate))}`;
      } else {
        this.sheetName = `weekend-${weekStartDate}`;
      }
    } else if (weekStartDate instanceof Date) {
      // Dateオブジェクトが渡された場合
      this.sheetName = `weekend-${this.formatDateForSheet(weekStartDate)}`;
    } else {
      // 現在の週の土曜日を使用
      const currentSaturday = this.getCurrentSaturday();
      this.sheetName = `weekend-${this.formatDateForSheet(currentSaturday)}`;
    }
    
    this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.sheetName);
    if (!this.sheet) {
      // シートが存在しない場合は作成
      this.createWeekendSheet();
    }
  }

  /**
   * 現在の週の土曜日を取得
   * @returns {Date} 土曜日の日付
   */
  getCurrentSaturday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=日曜日, 6=土曜日
    const daysToSaturday = (6 - dayOfWeek) % 7;
    
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysToSaturday);
    
    return saturday;
  }

  /**
   * 日付をシート名用の文字列に変換
   * @param {Date} date - 日付
   * @returns {string} YYYYMMDD形式の文字列
   */
  formatDateForSheet(date) {
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMMdd');
  }

  /**
   * 新しいweekendシートを作成
   */
  createWeekendSheet() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = spreadsheet.insertSheet(this.sheetName);
    
    // ヘッダー行を設定
    const headers = ['ID', 'category', 'item', 'unnecessary', 'done'];
    this.sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // ヘッダー行のスタイルを設定
    const headerRange = this.sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#34495e');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    Logger.log(`Created new weekend sheet: ${this.sheetName}`);
  }

  /**
   * スプレッドシートからデータ取得
   * @returns {Array<Object>} item オブジェクトのリスト
   */
  getAllItems() {
    const data = this.sheet.getDataRange().getValues();
    const headers = data.shift();

    return data.map(row => {
      let item = {};
      headers.forEach((header, i) => item[header] = row[i]);
      return item;
    });
  }

  /**
   * ID を指定して不要 / 完了 状態を更新
   * @param {number} id - 更新対象の ID
   * @param {string} field - 'unnecessary' または 'done'
   * @param {boolean} value - 設定する値
   */
  updateItemStatus(id, field, value) {
    if (!(field === 'unnecessary' || field === 'done')) {
      throw new Error('Invalid field: ' + field);
    }

    const data = this.sheet.getDataRange().getValues();

    const headers = data[0];
    const idCol = headers.indexOf('ID');
    const fieldCol = headers.indexOf(field);

    for (let row = 1; row < data.length; row++) {
      if (data[row][idCol] === id) {
        this.sheet.getRange(row + 1, fieldCol + 1).setValue(value);
        return;
      }
    }

    throw new Error('Item with ID ' + id + ' not found.');
  }

  /**
     * データハッシュ生成
   * @param {Range} range - データ範囲
   * @returns {string} ハッシュ値
   */
  generateDataHash() {
    const range = this.sheet.getDataRange();
    const values = range.getValues();
    // ヘッダー行を除外してハッシュ化
    const dataString = JSON.stringify(values.slice(1));
    const rawBytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, 
      dataString,
      Utilities.Charset.UTF_8
    );
    const dataHash = rawBytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    Logger.log("Debug: dataHash=" + dataHash);
    return dataHash;
  }

}

function updateItemStatus(id, field, value) {
  return updateWeekendItemStatus(null, id, field, value);
}

/**
 * テスト用サンプルデータを作成
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @returns {Object} 作成結果
 */
function createSampleWeekendData(weekStart) {
  try {
    const weekendItems = new WeekendItems(weekStart);
    
    // サンプルデータ
    const sampleData = [
      { id: 1, category: '野菜', item: 'にんじん', unnecessary: false, done: false },
      { id: 2, category: '野菜', item: 'たまねぎ', unnecessary: false, done: true },
      { id: 3, category: '肉類', item: '鶏むね肉', unnecessary: false, done: false },
      { id: 4, category: '肉類', item: '豚バラ肉', unnecessary: true, done: false },
      { id: 5, category: '調味料', item: '醤油', unnecessary: false, done: false },
      { id: 6, category: '調味料', item: 'みりん', unnecessary: false, done: true },
      { id: 7, category: '乳製品', item: '牛乳', unnecessary: false, done: false },
      { id: 8, category: '乳製品', item: 'チーズ', unnecessary: false, done: false }
    ];
    
    // ヘッダー行を確認・作成
    const headers = ['ID', 'category', 'item', 'unnecessary', 'done'];
    weekendItems.sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // サンプルデータを挿入
    const now = new Date();
    const dataRows = sampleData.map(item => [
      item.id,
      item.category,
      item.item,
      item.unnecessary,
      item.done,
      now
    ]);
    
    weekendItems.sheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
    
    // ヘッダー行のスタイルを設定
    const headerRange = weekendItems.sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#34495e');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    
    Logger.log(`Created sample data for ${weekStart}: ${sampleData.length} items`);
    
    return {
      success: true,
      message: `サンプルデータを作成しました (${sampleData.length}件)`,
      itemCount: sampleData.length
    };
    
  } catch (error) {
    Logger.log('Error creating sample data:', error.message);
    return {
      success: false,
      message: 'サンプルデータの作成に失敗しました: ' + error.message
    };
  }
}

/**
 * テスト用関数 - サンプルデータ作成のテスト
 */
// function testCreateSampleData() {
//   Logger.log('=== サンプルデータ作成テスト開始 ===');
  
//   // 現在の週の土曜日を取得
//   const today = new Date();
//   const dayOfWeek = today.getDay();
//   const daysToSaturday = (6 - dayOfWeek) % 7;
//   const saturday = new Date(today);
//   saturday.setDate(today.getDate() + daysToSaturday);
//   const weekStart = Utilities.formatDate(saturday, 'Asia/Tokyo', 'yyyy-MM-dd');
  
//   Logger.log('テスト対象週:', weekStart);
  
//   const result = createSampleWeekendData(weekStart);
//   Logger.log('作成結果:', result);
  
//   if (result.success) {
//     // 作成されたデータを確認
//     const items = getWeekendItems(weekStart);
//     Logger.log('作成されたアイテム数:' + items.length);
//     Logger.log('サンプルアイテム:' + items.slice(0, 3));
//   }
  
//   Logger.log('=== サンプルデータ作成テスト終了 ===');
// }

function testWeekendFunctions() {
  // date = new Date();
  // date = "20250712";
  date = "2025-07-12";
  weekendItems = new WeekendItems(date);
  const testData = weekendItems.getItems(date);
  Logger.log(testData);

}

/**
 * 指定された週のWeekendアイテムを取得（統合アプリ用）
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @returns {Array<Object>} item オブジェクトのリスト
 */
function getWeekendItemsForApp(weekStart) {
  Logger.log("Debug: getWeekendItemsForApp starts, weekStart=" + weekStart);
  try {
    // アクセス制御チェック
    checkAccess();

    // data
    const weekendItems = new WeekendItems(weekStart);
    const items = weekendItems.getAllItems();
    Logger.log("Debug: items: " + items);
    const hash = weekendItems.generateDataHash();
    return {items: items, hash: hash};
  } catch (error) {
    Logger.log('Error in getWeekendItemsForApp:', error.message);
    throw error;
  }
}

/**
 * 指定された週のWeekendアイテムのステータスを更新（統合アプリ用）
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @param {number} id - 更新対象の ID
 * @param {string} field - 'unnecessary' または 'done'
 * @param {boolean} value - 設定する値
 * @returns {Object} 結果オブジェクト
 */
function updateWeekendItemStatusForApp(weekStart, id, field, value, clientHash) {
  try {
    const weekendItems = new WeekendItems(weekStart);
    const serverPreHash = weekendItems.generateDataHash();
    let noConflict = false;
    Logger.log('Hash from client: ' + clientHash);
    Logger.log('Hash from prev:   ' + serverPreHash);
    if (serverPreHash === clientHash) {
      noConflict =  true;
    }

    weekendItems.updateItemStatus(id, field, value);
    const newServerHash = weekendItems.generateDataHash();

    if (noConflict) {
      Logger.log('Update without conflict')
      return {
        success: true,
        hash: newServerHash,
        conflict: false        
      }
    } else {
      Logger.log('Update with conflict')
      return {
        success: true,
        hash: newServerHash,
        conflict: true,
        items: weekendItems.getAllItems()
      }
    }
  } catch (error) {
    Logger.log('Error in updateWeekendItemStatusForApp:' + error.message);
    throw error;
  }
}

/**
 * Web アプリ用: サンプルデータ作成
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @returns {Object} 作成結果
 */
function createWeekendSampleData(weekStart) {
  return createSampleWeekendData(weekStart);
}

/**
 * ハッシュベースのデータ取得（改善されたポーリング用）
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @param {string} clientHash - クライアントが持っているハッシュ
 * @returns {Object} データまたはハッシュ情報
 */
function getWeekendDataIfChangedForApp(weekStart, clientHash) {
  try {
    // アクセス制御チェック
    checkAccess();
    
    const weekendItems = new WeekendItems(weekStart);
    const serverHash = weekendItems.generateDataHash();
    
    Logger.log(`Hash comparison - Client: ${clientHash}, Server: ${serverHash}`);
    
    if (clientHash !== serverHash) {
      // ハッシュが異なる場合、全データを返す
      const items = weekendItems.getAllItems();
      Logger.log(`Data changed, returning ${items.length} items`);
      
      return {
        changed: true,
        items: items,
        hash: serverHash,
        // timestamp: new Date().toISOString()
      };
    } else {
      // ハッシュが同じ場合
      Logger.log('No changes detected');
      return {
        changed: false,
        hash: serverHash,
        // timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    Logger.log('Error in getWeekendDataIfChanged:', error.message);
    throw error;
  }
}
