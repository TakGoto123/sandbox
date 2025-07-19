/**
 * 献立管理システム - Google Apps Script
 * メイン処理とユーティリティ関数
 */

// ========================================
// 定数定義
// ========================================

/**
 * config シートを辞書として読み込む
 * A列: パラメータ名、B列以降: 値（配列も可）
 * @returns {Object} 辞書形式の設定
 */
function loadConfigAsDict(sheet_name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet_name);
  if (!sheet) throw new Error('config シートが見つかりません');

  const range = sheet.getDataRange();
  const values = range.getValues();  // 2次元配列

  const configDict = {};

  values.forEach(row => {
    const key = row[0]?.toString().trim();
    if (!key) return;

    const rawValues = row.slice(1).filter(val => val !== '' && val != null);
    configDict[key] = rawValues.length === 1 ? rawValues[0] : rawValues;
  });

  Logger.log(JSON.stringify(configDict, null, 2));
  return configDict;
}

const PRIVATE_CONFIG = loadConfigAsDict("private-config");
const COMMON_CONFIG = loadConfigAsDict("common-config");
const CONFIG = { ...PRIVATE_CONFIG, ...COMMON_CONFIG};
Logger.log("CONFIG:\n" + CONFIG);

// ========================================
// アクセス制御機能
// ========================================
/**
 * アクセス制御チェック
 * @returns {string} 認証されたユーザーのメールアドレス
 * @throws {Error} アクセスが許可されていない場合
 */
function checkAccess() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    Logger.log(`取得したユーザーメール: "${userEmail}"`);
    Logger.log(`ユーザーメールの型: ${typeof userEmail}`);
    Logger.log(`許可されたユーザー一覧: ${JSON.stringify(CONFIG.ALLOWED_USERS)}`);
    
    if (!userEmail || userEmail.trim() === '') {
      Logger.log('ユーザーメールが空です');
      throw new Error('ユーザー情報を取得できませんでした。Googleアカウントでログインしてください。');
    }
    
    const trimmedEmail = userEmail.trim().toLowerCase();
    const allowedEmailsLower = CONFIG.ALLOWED_USERS.map(email => email.toLowerCase());
    
    Logger.log(`正規化されたユーザーメール: "${trimmedEmail}"`);
    Logger.log(`正規化された許可リスト: ${JSON.stringify(allowedEmailsLower)}`);
    
    if (!allowedEmailsLower.includes(trimmedEmail)) {
      Logger.log(`アクセス拒否: ${trimmedEmail} は許可リストに含まれていません`);
      throw new Error(`アクセスが許可されていません: ${userEmail}`);
    }
    
    Logger.log(`アクセス許可: ${userEmail}`);
    return userEmail;
    
  } catch (error) {
    Logger.log(`checkAccess エラー: ${error.message}`);
    throw error;
  }
}

// ========================================
// メイン処理
// ========================================

/**
 * Webアプリのメインエントリーポイント
 * @param {Object} e - リクエストパラメータ
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  try {
    // アクセス制御チェック
    const userEmail = checkAccess();
    
    const meal_plan = getMealData();
    // Logger.log("Debug: meal_plan: " + JSON.stringify(meal_plan));
    const template = createHtmlTemplate(meal_plan);
    return template.evaluate().setTitle('献立一覧');
  } catch (error) {
    Logger.log(`Access denied or error: ${error.message}`);
    
    // アクセス拒否エラーの場合は専用ページを表示
    if (error.message.includes('アクセスが許可されていません') || 
        error.message.includes('ユーザー情報を取得できませんでした')) {
      return createAccessDeniedPage(error.message);
    }
    
    // その他のエラーは通常のエラーページ
    return createErrorPage(error.message);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ========================================
// データ取得・処理
// ========================================

/**
 * スプレッドシートから献立データを取得
 * @returns {Object} ヘッダーとデータを含むオブジェクト
 */
function getMealData() {
  const sheet = getSheet(CONFIG.MEAL_PLAN_SHEET_NAME);
  const rawData = sheet.getDataRange().getValues();
  
  if (rawData.length === 0) {
    throw new Error('データが存在しません');
  }
  
  const headers = rawData.shift();
  
  // ハイパーリンク情報も取得するため、データ範囲を再取得
  const dataRange = sheet.getRange(2, 1, rawData.length, headers.length);
  const data = rawData.map((row, index) => normalizeDataRowWithHyperlinks(row, dataRange, index));
  
  return {
    headers: headers,
    data: data
  };
}

/**
 * 指定されたシートを取得
 * @param {string} sheetName - シート名
 * @returns {Sheet} スプレッドシートオブジェクト
 */
function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`シート "${sheetName}" が見つかりませんでした`);
  }
  return sheet;
}

/**
 * データ行を正規化
 * @param {Array} row - 生データの行
 * @returns {Array} 正規化されたデータ行
 */
function normalizeDataRow(row) {
  const [date, type, menu, memo] = row;
  return [
    formatDate(date),
    String(type || '').trim(),
    String(menu || '').trim(),
    String(memo || '').trim()
  ];
}

/**
 * ハイパーリンク情報を含むデータ行を正規化
 * @param {Array} row - 生データの行
 * @param {Range} dataRange - データ範囲
 * @param {number} rowIndex - 行インデックス
 * @returns {Array} 正規化されたデータ行
 */
function normalizeDataRowWithHyperlinks(row, dataRange, rowIndex) {
  const [date, type, menu, memo, id] = row;
  
  // メニュー列（3列目）のハイパーリンク情報を取得
  let processedMenu = String(menu || '').trim();
  
  try {
    // セルの範囲を取得（行は1ベースなので+1、列は3列目）
    const menuCell = dataRange.getCell(rowIndex + 1, 3);
    
    // セルにハイパーリンクが設定されているかチェック
    const formula = menuCell.getFormula();
    if (formula && formula.includes('HYPERLINK')) {
      // HYPERLINK関数からURLとテキストを抽出
      const hyperlinkMatch = formula.match(/=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)/);
      if (hyperlinkMatch) {
        const url = hyperlinkMatch[1];
        const text = hyperlinkMatch[2];
        
        // オブジェクト形式で返す
        processedMenu = {
          text: text,
          url: url
        };
        
        Logger.log(`Found hyperlink: ${text} -> ${url}`);
      }
    }
  } catch (error) {
    Logger.log(`Error processing hyperlink for row ${rowIndex}: ${error.message}`);
    // エラーが発生した場合は元のテキストをそのまま使用
  }
  
  return [
    formatDate(date),
    String(type || '').trim(),
    processedMenu,
    String(memo || '').trim(),
    id
  ];
}

// ========================================
// HTML テンプレート処理
// ========================================

/**
 * HTMLテンプレートを作成
 * @param {Object} mealData - 献立データ
 * @returns {HtmlTemplate} HTMLテンプレート
 */
function createHtmlTemplate(meal_plan, shopping_items=null, todo_items=null) {
  const template = HtmlService.createTemplateFromFile('client-main');
  template.meal_plan = meal_plan;
  template.shopping_items = shopping_items;
  template.todo_items = todo_items;
  template.config = COMMON_CONFIG;
  return template;
}

/**
 * エラーページを作成
 * @param {string} errorMessage - エラーメッセージ
 * @returns {HtmlOutput} エラーページ
 */
function createErrorPage(errorMessage) {
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>エラー</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>エラーが発生しました</h2>
          <p>${errorMessage}</p>
        </div>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

/**
 * アクセス拒否ページを作成
 * @param {string} errorMessage - エラーメッセージ
 * @returns {HtmlOutput} アクセス拒否ページ
 */
function createAccessDeniedPage(errorMessage) {
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>アクセス拒否</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            max-width: 500px;
            width: 100%;
            overflow: hidden;
          }
          .header {
            background: #f44336;
            color: white;
            padding: 30px;
            text-align: center;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 15px;
            display: block;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 300;
          }
          .content {
            padding: 30px;
            text-align: center;
          }
          .message {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .details {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            font-size: 14px;
            color: #888;
            margin-top: 20px;
            word-break: break-all;
          }
          .contact {
            margin-top: 25px;
            padding-top: 25px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 14px;
          }
          @media (max-width: 600px) {
            body { padding: 20px 10px; }
            .header { padding: 20px; }
            .content { padding: 20px; }
            .icon { font-size: 48px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="icon">🔒</span>
            <h1>アクセスが制限されています</h1>
          </div>
          <div class="content">
            <div class="message">
              <p><strong>このアプリケーションは家族専用です。</strong></p>
              <p>許可されたGoogleアカウントでのみアクセスできます。</p>
            </div>
            
            <div class="details">
              <strong>エラー詳細:</strong><br>
              ${errorMessage}
            </div>
            
            <div class="contact">
              アクセスが必要な場合は、<br>
              アプリケーション管理者にお問い合わせください。
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

// ========================================
// 日付ユーティリティ関数
// ========================================

/**
 * 日付を文字列形式に変換
 * @param {Date|string} date - 日付オブジェクトまたは文字列
 * @returns {string} yyyy-MM-dd形式の日付文字列
 */
function formatDate(date) {
  if (!date) return '';
  
  if (date instanceof Date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  }
  
  const dateStr = String(date).trim();
  if (isValidDateString(dateStr)) {
    return dateStr;
  }
  
  // 日付として解釈を試行
  const parsedDate = new Date(dateStr);
  if (!isNaN(parsedDate.getTime())) {
    return Utilities.formatDate(parsedDate, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  }
  
  return dateStr;
}

/**
 * 日付文字列の妥当性をチェック
 * @param {string} dateStr - 日付文字列
 * @returns {boolean} 妥当な場合true
 */
function isValidDateString(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}

/**
 * デフォルトの週開始日（土曜日）を取得
 * @returns {string} yyyy-MM-dd形式の日付文字列
 */
function getDefaultWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = (dayOfWeek === CONFIG.WEEK_START_DAY) ? 0 : (dayOfWeek + 1) % 7;
  
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysToSubtract);
  
  return formatDate(saturday);
}

/**
 * 指定された週の平日の日付配列を取得
 * @param {string} weekStart - 週開始日（土曜日）
 * @returns {Array<string>} 平日の日付配列
 */
function getWeekDates(weekStart) {
  const startDate = new Date(weekStart);
  return CONFIG.WORK_DAYS.map(offset => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    return formatDate(date);
  });
}

/**
 * 週表示用の文字列を生成
 * @param {string} weekStart - 週開始日
 * @returns {string} 表示用文字列
 */
function formatWeekDisplay(weekStart) {
  const saturday = new Date(weekStart);
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  
  return `${monday.getFullYear()}年${monday.getMonth() + 1}月${monday.getDate()}日週`;
}

// ========================================
// データ更新・追加機能
// ========================================

/**
 * 新しい献立をスプレッドシートに追加
 * @param {string} date - 日付（yyyy-MM-dd形式）
 * @param {string} type - 区分（弁当、夜）
 * @param {Object} menu - メニューオブジェクト {text: string, url: string}
 * @param {string} memo - メモ
 * @returns {Object} 結果オブジェクト
 */
function addMealData(date, type, menu, memo, id=null) {
  try {
    const sheet = getSheet(CONFIG.MEAL_PLAN_SHEET_NAME);
    
    // メニューオブジェクトからテキストを取得
    const menuText = menu && menu.text ? menu.text : '';
    const menuUrl = menu && menu.url ? menu.url : null;
    
    // 新しい行を追加
    if (!id) {
      id = created_timestamp = new Date().toISOString();
    }
    const newRow = [date, type, menuText, memo || '', id];
    const lastRow = sheet.getLastRow() + 1;
    
    // データを追加
    sheet.getRange(lastRow, 1, 1, 5).setValues([newRow]);
    
    // URLが有効な場合、ハイパーリンクとして設定
    if (menuUrl && isValidUrl(menuUrl)) {
      const cell = sheet.getRange(lastRow, 3); // 3列目（メニュー名）
      cell.setFormula(`=HYPERLINK("${menuUrl}", "${menuText}")`);
      Logger.log('Set hyperlink:', { url: menuUrl, text: menuText });
    }
    
    Logger.log('Added new meal:', newRow);
    
    return {
      success: true,
      message: '献立を追加しました',
      data: newRow
    };
  } catch (error) {
    Logger.log('Error adding meal data:', error.message);
    return {
      success: false,
      message: 'データの追加に失敗しました: ' + error.message
    };
  }
}


/**
 * URLからタイトルのみを取得（モーダル用）
 * @param {string} url - URL
 * @returns {Object} 結果オブジェクト
 */
function fetchTitleFromUrl(url) {
  Logger.log("hoge01");

  try {
    if (!url || !isValidUrl(url)) {
      Logger.log("Invalid URL: " + url);
      return {
        success: false,
        message: '有効なURLを入力してください'
      };
    }

    Logger.log("hoge02");
    // URLからHTMLを取得
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      muteHttpExceptions: true
    });

    Logger.log("hoge03, Response Code: " + response.getResponseCode());
    if (response.getResponseCode() !== 200) {
      return {
        success: false,
        message: 'ページの取得に失敗しました'
      };
    }

    const html = response.getContentText();
    Logger.log("hoge04");

    // タイトルタグを抜き出す
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : url;
    Logger.log("title: " + title);

    // タイトルが取れなければURLのまま
    if (!title || title === '') {
      title = url;
    }

    // HTMLエンティティをデコード
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    Logger.log("decoded title: " + title);

    return {
      success: true,
      title: title,
      url: url
    };

  } catch (error) {
    Logger.log('Error fetching title: ' + error.message);
    return {
      success: false,
      message: 'タイトルの取得中にエラーが発生しました: ' + error.message
    };
  }
}


/**
 * URLの妥当性をチェック
 * @param {string} url - チェックするURL
 * @returns {boolean} 妥当な場合true
 */
function isValidUrl(url) {
  Logger.log("url=" + url);

  const pattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  const isValid = pattern.test(url);

  return isValid;
}

/**
 * menu-listシートからメニュー情報を取得する（IDをキーとしたマップ形式）
 * @returns {Object.<string, {id: number, menu: string, ingredients: string}>}
 */
function getRegisteredMenusForApp() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('menu-list');
  if (!sheet) {
    throw new Error('menu-list シートが見つかりません');
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();

  const idIndex = headers.indexOf('ID');
  const menuIndex = headers.indexOf('menu');
  const ingredientsIndex = headers.indexOf('ingredients');

  if (idIndex === -1 || menuIndex === -1 || ingredientsIndex === -1) {
    throw new Error('ID、menu、ingredients のいずれかの列が見つかりません');
  }

  const result = {};

  values.forEach(row => {
    const id = row[idIndex];
    if (!id || !row[menuIndex]) return;

    result[id] = {
      id: id,
      menu: row[menuIndex],
      ingredients: row[ingredientsIndex] || ''
    };
  });

  return result;
}


// ========================================
// テスト・デバッグ用関数
// ========================================

/**
 * テスト用関数 - データ取得のテスト
 */
function testGetMealData() {
  try {
    const data = getMealData();
    Logger.log('Headers:', data.headers);
    Logger.log('Data count:', data.data.length);
    Logger.log('Sample data:', data.data.slice(0, 3));
  } catch (error) {
    Logger.log('Test error:', error.message);
  }
}

/**
 * テスト用関数 - ハイパーリンク取得のテスト
 */
function testGetMealDataWithHyperlinks() {
  try {
    Logger.log('=== ハイパーリンク取得テスト開始 ===');
    
    const data = getMealData();
    Logger.log('Headers:', data.headers);
    Logger.log('Data count:', data.data.length);
    
    // ハイパーリンクを含むデータをチェック
    data.data.forEach((row, index) => {
      const [date, type, menu, memo] = row;
      
      // メニューがオブジェクト形式（ハイパーリンク）の場合
      if (typeof menu === 'object' && menu !== null && menu.text && menu.url) {
        Logger.log(`Row ${index + 1}: ハイパーリンク発見`);
        Logger.log(`  日付: ${date}`);
        Logger.log(`  区分: ${type}`);
        Logger.log(`  メニューテキスト: ${menu.text}`);
        Logger.log(`  URL: ${menu.url}`);
        Logger.log(`  メモ: ${memo}`);
      }
    });
    
    Logger.log('=== ハイパーリンク取得テスト終了 ===');
  } catch (error) {
    Logger.log('Hyperlink test error:', error.message);
  }
}

/**
 * テスト用関数 - 日付関数のテスト
 */
function testDateFunctions() {
  const weekStart = getDefaultWeekStart();
  const weekDates = getWeekDates(weekStart);
  const weekDisplay = formatWeekDisplay(weekStart);
  
  Logger.log('Week start:', weekStart);
  Logger.log('Week dates:', weekDates);
  Logger.log('Week display:', weekDisplay);
}

/**
 * テスト用関数 - 献立追加のテスト
 */
function testAddMealData() {
  const result = addMealData('2025-01-07', '弁当', 'テスト料理', 'テストメモ');
  Logger.log('Add meal result:', result);
}

/**
 * テスト用関数 - fetchTitleFromUrlのテスト
 */
function testFetchTitleFromUrl() {
  Logger.log('=== fetchTitleFromUrl テスト開始 ===');
  
  // テストケース1: 有効なURL
  const testUrl1 = 'https://www.google.com';
  Logger.log('テスト1: 有効なURL -', testUrl1);
  const result1 = fetchTitleFromUrl(testUrl1);
  Logger.log('結果1:', result1);
  
  // テストケース2: 無効なURL
  const testUrl2 = 'invalid-url';
  Logger.log('テスト2: 無効なURL -', testUrl2);
  const result2 = fetchTitleFromUrl(testUrl2);
  Logger.log('結果2:', result2);
  
  // テストケース3: 空文字列
  const testUrl3 = '';
  Logger.log('テスト3: 空文字列');
  const result3 = fetchTitleFromUrl(testUrl3);
  Logger.log('結果3:', result3);
  
  // テストケース4: null
  const testUrl4 = null;
  Logger.log('テスト4: null');
  const result4 = fetchTitleFromUrl(testUrl4);
  Logger.log('結果4:', result4);
  
  // テストケース5: レシピサイトのURL（実際のレシピサイト）
  const testUrl5 = 'https://www.kurashiru.com/recipes/9f45e150-c4b7-4955-b3a5-aad29911c738';
  Logger.log('テスト5: レシピサイト -')
  Logger.log(testUrl5)
  const result5 = fetchTitleFromUrl(testUrl5);
  Logger.log('結果5:', result5);
  
  Logger.log('=== fetchTitleFromUrl テスト終了 ===');
}


function deleteMealDataByIdForApp(del_id) {
  try {
    const sheet = getSheet(CONFIG.MEAL_PLAN_SHEET_NAME);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      return {
        success: false,
        message: '削除するデータが見つかりません'
      };
    }
    
    // ヘッダー行を除いてデータを検索
    let targetRowIndex = -1;
    let date, type, menuText, memo;
    for (let i = 1; i < values.length; i++) {
      const [rowDate, rowType, rowMenu, rowMemo, id] = values[i];
      
      if (id === del_id) {
        targetRowIndex = i + 1; // スプレッドシートは1ベース
        date = rowDate;
        type = rowType;
        menuText = rowMenu;
        memo = rowMemo;
        break;
      }
    } 

    if (targetRowIndex === -1) {
      Logger.log('削除対象が見つかりません:', { date, type, menuText, memo });
      return {
        success: false,
        message: '削除対象のデータが見つかりません'
      };
    }
    
    // 行を削除
    sheet.deleteRow(targetRowIndex);
    
    Logger.log('行を削除しました:', { rowIndex: targetRowIndex, date, type, menuText, memo });
    
    return {
      success: true,
      message: '献立を削除しました',
      deletedRow: targetRowIndex
    };
    
  } catch (error) {
    Logger.log('Error deleting meal data:', error.message);
    return {
      success: false,
      message: 'データの削除に失敗しました: ' + error.message
    };
  }
}

/**
 * テスト用関数 - fetchTitleFromUrlの詳細テスト
 */
function testFetchTitleFromUrlDetailed() {
  Logger.log('=== fetchTitleFromUrl 詳細テスト開始 ===');
  
  // 複数のURLでテスト
  const testUrls = [
    'https://www.google.com',
    'https://github.com',
    'https://stackoverflow.com',
    'https://example.com',
    'https://httpbin.org/html' // HTMLテスト用
  ];
  
  testUrls.forEach((url, index) => {
    Logger.log(`--- テスト ${index + 1}: ${url} ---`);
    const startTime = new Date().getTime();
    
    try {
      const result = fetchTitleFromUrl(url);
      const endTime = new Date().getTime();
      const duration = endTime - startTime;
      
      Logger.log('成功:', result.success);
      Logger.log('タイトル:', result.title);
      Logger.log('処理時間:', duration + 'ms');
      
      if (!result.success) {
        Logger.log('エラーメッセージ:', result.message);
      }
    } catch (error) {
      Logger.log('例外発生:', error.message);
    }
    
    Logger.log(''); // 空行
  });
  
  Logger.log('=== fetchTitleFromUrl 詳細テスト終了 ===');
}

/**
 * テスト用関数 - アクセス制御のテスト
 */
function testAccessControl() {
  Logger.log('=== アクセス制御テスト開始 ===');
  
  try {
    const userEmail = checkAccess();
    Logger.log('アクセス許可:', userEmail);
  } catch (error) {
    Logger.log('アクセス拒否:', error.message);
  }
  
  Logger.log('許可されたユーザー一覧:', ALLOWED_USERS);
  Logger.log('現在のユーザー:', Session.getActiveUser().getEmail());
  
  Logger.log('=== アクセス制御テスト終了 ===');
}

/**
 * テスト用関数 - Weekend機能のテスト
 */
function testWeekendFunctions() {
  Logger.log('=== Weekend機能テスト開始 ===');
  
  try {
    // 現在の週の土曜日を取得
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToSaturday = (6 - dayOfWeek) % 7;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysToSaturday);
    const weekStart = Utilities.formatDate(saturday, 'Asia/Tokyo', 'yyyy-MM-dd');
    
    Logger.log('テスト対象週:', weekStart);
    
    // Weekendアイテム取得テスト
    const items = getWeekendItems(weekStart);
    Logger.log('取得したアイテム数:', items.length);
    Logger.log('サンプルアイテム:', items.slice(0, 3));
    
  } catch (error) {
    Logger.log('Weekend機能テストエラー:', error.message);
  }
  
  Logger.log('=== Weekend機能テスト終了 ===');
}

/**
 * 指定期間の買い出しリスト作成（統合アプリ用）
 * @param {string} startDate - 開始日（yyyy-MM-dd形式）
 * @param {string} endDate - 終了日（yyyy-MM-dd形式）
 * @returns {Object} 作成結果
 */
function createShoppingListForPeriodForApp(startDate, endDate) {
  try {
    // アクセス制御チェック
    checkAccess();
    
    Logger.log(`Creating shopping list for period: ${startDate} to ${endDate}`);
    
    // 日付形式のバリデーション
    validateDateRange(startDate, endDate);
    
    // 1. buildGeminiPromptForPeriodを呼び出し
    const prompt = buildGeminiPromptForPeriod(startDate, endDate);
    Logger.log('Gemini prompt created');
    
    // 2. fetchIngredientsFromGeminiを呼び出し
    const geminiResponse = fetchIngredientsFromGemini(prompt);
    Logger.log('Gemini response received');
    
    // 3. 前の土曜日を計算（YYYYMMDDフォーマット）
    const saturdayDate = calculatePreviousSaturday(startDate);
    const sheetName = `weekend-${saturdayDate}`;
    Logger.log(`Target sheet: ${sheetName}`);
    
    // 4. シートを取得または作成
    const weekendItems = new WeekendItems(saturdayDate);
    Logger.log('WeekendItems instance created');
    
    // 5. CSV抽出とシート書き込み
    const csvData = extractCsvFromGeminiText(geminiResponse);
    writeExtractedCsvToSheet(csvData, sheetName);
    Logger.log('CSV data written to sheet');
    
    Logger.log(`Shopping list created successfully for ${startDate} to ${endDate} in sheet ${sheetName}`);
    
    return {
      success: true,
      message: '買い出しリストを作成しました',
      sheetName: sheetName,
      period: `${startDate} ～ ${endDate}`
    };
  } catch (error) {
    Logger.log('Error creating shopping list: ' + error.message);
    return {
      success: false,
      message: 'エラーが発生しました: ' + error.message
    };
  }
}

/**
 * 前の土曜日を計算
 * @param {string} dateStr - 日付文字列（yyyy-MM-dd形式）
 * @returns {string} 前の土曜日（yyyyMMdd形式）
 */
function calculatePreviousSaturday(dateStr) {
  Logger.log(`Calculating previous Saturday for: ${dateStr}`);
  
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0=日曜日, 6=土曜日
  
  // 前の土曜日までの日数を計算
  // 月曜日(1) -> 2日前, 火曜日(2) -> 3日前, ..., 日曜日(0) -> 1日前
  const daysToSubtract = (dayOfWeek + 1) % 7;
  
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - daysToSubtract);
  
  const result = Utilities.formatDate(saturday, 'Asia/Tokyo', 'yyyyMMdd');
  Logger.log(`Previous Saturday: ${result}`);
  
  return result;
}

/**
 * 日付範囲のバリデーション
 * @param {string} startDate - 開始日
 * @param {string} endDate - 終了日
 */
function validateDateRange(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error('Invalid date format');
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date values');
  }
  
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
}

/**
 * 買い出しリスト作成のテスト関数
 */
function testCreateShoppingListForPeriod() {
  try {
    Logger.log('=== 買い出しリスト作成テスト開始 ===');
    
    const startDate = '2025-07-14';
    const endDate = '2025-07-18';
    
    Logger.log(`テスト期間: ${startDate} ～ ${endDate}`);
    
    const result = createShoppingListForPeriodForApp(startDate, endDate);
    
    Logger.log('テスト結果:', result);
    
    if (result.success) {
      Logger.log('✅ 買い出しリスト作成成功');
      Logger.log(`シート名: ${result.sheetName}`);
      Logger.log(`対象期間: ${result.period}`);
    } else {
      Logger.log('❌ 買い出しリスト作成失敗');
      Logger.log(`エラー: ${result.message}`);
    }
    
    Logger.log('=== 買い出しリスト作成テスト終了 ===');
    
  } catch (error) {
    Logger.log('テストエラー:', error.message);
  }
}

/**
 * 前の土曜日計算のテスト関数
 */
function testCalculatePreviousSaturday() {
  Logger.log('=== 前の土曜日計算テスト開始 ===');
  
  const testDates = [
    '2025-07-14', // 月曜日
    '2025-07-15', // 火曜日
    '2025-07-16', // 水曜日
    '2025-07-17', // 木曜日
    '2025-07-18', // 金曜日
    '2025-07-19', // 土曜日
    '2025-07-20'  // 日曜日
  ];
  
  testDates.forEach(date => {
    const saturday = calculatePreviousSaturday(date);
    Logger.log(`${date} の前の土曜日: ${saturday}`);
  });
  
  Logger.log('=== 前の土曜日計算テスト終了 ===');
}

/**
 * Weekendサンプルデータ作成（統合アプリ用）
 * @param {string} weekStart - 週開始日（土曜日、YYYY-MM-DD形式）
 * @returns {Object} 作成結果
 */
function createWeekendSampleData(weekStart) {
  try {
    checkAccess();
    return createSampleWeekendData(weekStart);
  } catch (error) {
    Logger.log('Error in createWeekendSampleData:', error.message);
    throw error;
  }
}

// ========================================
// TODO機能統合（統合アプリ用）
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
    return {
      success: false,
      message: 'TODOデータの取得に失敗しました: ' + error.message,
      data: []
    };
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
    return {
      success: false,
      message: 'TODO状態の更新に失敗しました: ' + error.message
    };
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
    return {
      success: false,
      message: 'TODOの追加に失敗しました: ' + error.message
    };
  }
}

/**
 * 統合アプリ用のTODO削除関数
 * @param {number} rowNumber - 行番号
 * @returns {Object} 削除結果
 */
function deleteTodoForApp(rowNumber) {
  try {
    return deleteTodoItem(rowNumber);
  } catch (error) {
    Logger.log('Error in deleteTodoForApp:', error.message);
    return {
      success: false,
      message: 'TODOの削除に失敗しました: ' + error.message
    };
  }
}
