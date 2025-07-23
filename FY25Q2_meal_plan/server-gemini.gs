/**
 * 指定期間の献立データから Gemini 用プロンプトを作成
 * @param {string} startDate - yyyy-MM-dd
 * @param {string} endDate - yyyy-MM-dd
 * @returns {string} Gemini API に送る指示文
 */
function buildGeminiPromptForPeriod(startDate, endDate) {
  const allData = getMealData().data;
  const mealsInRange = allData.filter(([date]) => startDate <= date && date <= endDate);

  if (mealsInRange.length === 0) {
    return '指定期間に料理がありません。';
  }

  const recipeDescriptions = mealsInRange.map(([date, type, menu, url, memo], idx) => {
    // メニュー名取得
    if (url) {
      recipePart = `URL:\n${url}`;
    } else if (memo) {
      recipePart = `材料メモ：\n${memo.trim()}`;
    }
    // 料理1件あたりの記述
    return recipePart
      ? `# ${idx+1}番目の料理\n## 料理名：${menu}\n## ${recipePart}`
      : '';
  });

  const recipeListText = recipeDescriptions.join('\n');

  // 最終的なプロンプト文
  const prompt = `
今から複数の料理を【料理一覧】下に順番にリストアップします。
それぞれの料理に対して、3人分の材料と分量を下記のルールに従いリストアップしてください。

- URL:で記載されている場合
  - リンク先のページの内容を参照し、３人分の材料をピックアップしてください。
- 材料メモ：で記載されている場合
  - その情報を忠実に守って３人分の材料をピックアップしてください。余計な補完は不要です。
  - 【1人分】【2人分】などの記載がある場合は、その人数分をもとに3人前を換算してください。
  - 人数の指定がない場合は、その分量を３人分とみなしてください。
- 各料理に対して、材料名、分量を正確に記載してください。
- この後、買い出しリスト作成のために材料の分量を集計するため、同じ料理があってもスキップはしないでください。

【料理一覧】
${recipeListText}

------------
次に、上記でリストアップした材料を買い出しようにまとめてください。
その際、以下のルールにしたがってください。

- 材料ごとにまとめ、同じ材料は合算してください。
- 材料名、合計分量、単位を明記してください。
- 買い物しやすいように、分類ごとに並ぶようにソートしてください
  - 分類は、1.野菜, 2.肉・魚, 3.その他、です
- フォーマットはcsv形式でお願いします
  - 参考としてフォーマットのサンプルを以下に示します。
  - このフォーマットに沿って出力してください。

\`\`\`csv
ID,category,item,unnecessary,done
1,2.肉・魚,さけ：３尾,FALSE,FALSE
2,1.野菜,じゃがいも：３個,FALSE,FALSE
3,3.その他,薄力粉：300g,FALSE,FALSE
\`\`\`
`.trim();

  return prompt;
}


function fetchIngredientsFromGemini(prompt) {
  const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    tools: [
      {
        urlContext: {} // URL Context ツールを有効化
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      'X-goog-api-key': GEMINI_API_KEY
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    Logger.log("Response Code: " + responseCode);
    
    if (responseCode !== 200) {
      throw new Error(`Gemini API returned status ${responseCode}: ${response.getContentText()}`);
    }
    
    const rawText = response.getContentText();
    Logger.log("=== Gemini の返答（Raw） ===\n" + rawText);
    
    // JSONレスポンスをパース
    const jsonResponse = JSON.parse(rawText);
    
    // candidates[0].content.parts[0].textからテキストを取得
    if (jsonResponse.candidates && 
        jsonResponse.candidates[0] && 
        jsonResponse.candidates[0].content && 
        jsonResponse.candidates[0].content.parts && 
        jsonResponse.candidates[0].content.parts[0] && 
        jsonResponse.candidates[0].content.parts[0].text) {
      
      let generatedText = "";
      for (let i = 0; i < jsonResponse.candidates[0].content.parts.length; i++) {
        if (jsonResponse.candidates[0].content.parts[i].text) {
          generatedText += jsonResponse.candidates[0].content.parts[i].text;
        }
      }
      Logger.log("=== Gemini の返答（テキスト） ===\n" + generatedText);
      return generatedText;
    } else {
      throw new Error('Unexpected response format from Gemini API');
    }
  } catch (e) {
    Logger.log('Error in fetchIngredientsFromGemini: ' + e.toString());
    throw new Error('Gemini API呼び出しに失敗しました: ' + e.toString());
  }
}

/**
 * Geminiの返答テキストから ```csv ... ``` のブロックを抽出する
 * @param {string} text - Geminiの返答テキスト（model.content.parts[0].textなど）
 * @return {string} - CSV文字列（改行区切り）または空文字
 */
function extractCsvFromGeminiText(text) {
  const match = text.match(/```csv\s*([\s\S]*?)```/);
  if (match && match[1]) {
    const csvText = match[1].trim()
    const rows = csvText.split('\n').map(line => line.split(',').map(cell => cell.trim()));
    Logger.log("rows: ". rows);
    return rows;
  }

  Logger.log("```csv ブロックが見つかりませんでした。");
  throw new Error("csv ブロックが見つかりませんでした。");
}

/**
 * Gemini返答からCSVブロックを抽出して、指定シートにsetValuesで書き込む
 * @param {string} text - Geminiの出力全体（textフィールド）
 * @param {string} sheetName - スプレッドシートのシート名
 */
function writeExtractedCsvToSheet(csvData, sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`シート "${sheetName}" が見つかりません。`);
    throw new Error("シートが見つかりませんでした")
  }
  sheet.clearContents();
  sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);
}


/**
 * 指定期間の買い物リスト作成テスト
 */
function testBuildAndFetchGemini() {
  try {
    const startDate = '2025-07-14';
    const endDate = '2025-07-18';

    // プロンプト生成
    const prompt = buildGeminiPromptForPeriod(startDate, endDate);
    Logger.log('=== Gemini に渡すプロンプト ===\n' + prompt);

    if (false) {
      // Gemini API 呼び出し
      const geminiResult = fetchIngredientsFromGemini(prompt);
      Logger.log('=== Gemini の返答 ===\n' + geminiResult);
    }
  } catch (e) {
    Logger.log('Test error: ' + e.message);
  }
}

function testWrite() {
  const testText = "はい、承知いたしました。以下に料理ごとの材料リストと、最後に買い物リストをCSV形式でまとめます。\n\n## 料理ごとの材料リスト\n\n### 基本のマカロニグラタンのレシピ/作り方：白ごはん.com\n\n*   マカロニ：90g\n*   鶏もも肉：150g\n*   玉ねぎ：3/4個\n*   バター：30g\n*   薄力粉：30g\n*   牛乳：600ml\n*   塩：小さじ1/3\n*   こしょう：少々\n*   ピザ用チーズ：60g\n*   パン粉：大さじ3\n\n### 生姜焼き（１回目）\n\n*   豚ロース：450g\n*   生姜チューブ：6cm\n*   砂糖：小さじ1.5\n*   酒：大さじ1.5\n*   醤油：大さじ3\n*   みりん：大さじ3\n\n### あっさり煮（１回目）\n\n*   鶏手羽元：12本（720g）\n*   ゆで卵：3個\n*   ブロッコリー：適量\n*   ミツカン　味ぽん：1.5カップ\n*   水：1.5カップ\n\n### ☆そぼろ☆(そぼろ丼 鶏そぼろ) by ☆栄養士のれしぴ☆ 【クックパッド】\n\n*   鶏ひき肉：450g\n*   しょうがすりおろし：小さじ1/2\n*   醤油：大さじ3\n*   砂糖：大さじ2\n*   酒：大さじ2\n\n### 生姜焼き（２回目）\n\n*   豚ロース：450g\n*   生姜チューブ：6cm\n*   砂糖：小さじ1.5\n*   酒：大さじ1.5\n*   醤油：大さじ3\n*   みりん：大さじ3\n\n### 生姜焼き（３回目）\n\n*   豚ロース：450g\n*   生姜チューブ：6cm\n*   砂糖：小さじ1.5\n*   酒：大さじ1.5\n*   醤油：大さじ3\n*   みりん：大さじ3\n\n### 絶品とろ〜り卵！カツ丼の簡単レシピ | デリッシュキッチン\n\n*   豚ロース肉（とんかつ用）：3枚\n*   塩：少々\n*   こしょう：少々\n*   薄力粉：大さじ3\n*   卵：3個\n*   ご飯：600g\n*   揚げ油：適量\n*   玉ねぎ：1/2個\n*   めんつゆ（3倍濃縮）：大さじ6\n*   水：150ml\n*   みりん：大さじ3\n*   砂糖：大さじ1.5\n*   刻みネギ：適量\n\n### 大根の甘酢漬けのレシピ・作り方 ｜ おうちレシピ | ミツカングループ\n\n*   大根：300g\n*   塩：小さじ1.5\n*   砂糖：大さじ4.5\n*   穀物酢：75ml\n*   赤唐辛子：1/2本\n\n### 豪華な夕食♪ チキンカツカレーのレシピ動画・作り方 | デリッシュキッチン\n\n*   鶏もも肉：450g\n*   塩：少々\n*   こしょう：少々\n*   薄力粉：大さじ3\n*   卵：1個\n*   生パン粉：適量\n*   揚げ油：適量\n*   玉ねぎ：1個\n*   にんじん：1/2本\n*   じゃがいも：2個\n*   サラダ油：大さじ1\n*   水：600ml\n*   カレールー：90g\n*   ご飯：900g\n\n### あっさり煮（２回目）\n\n*   鶏手羽元：12本（720g）\n*   ゆで卵：3個\n*   ブロッコリー：適量\n*   ミツカン　味ぽん：1.5カップ\n*   水：1.5カップ\n\n### 肉じゃが\n\n*   じゃがいも：3個\n*   人参：2個\n\n## 買い物リスト (CSV形式)\n\n```csv\nID,category,item,unnecessary,done\n1,1.野菜,玉ねぎ：2.5個,FALSE,FALSE\n2,1.野菜,にんじん：2.5個,FALSE,FALSE\n3,1.野菜,じゃがいも：5個,FALSE,FALSE\n4,1.野菜,大根：300g,FALSE,FALSE\n5,1.野菜,ブロッコリー：適量,FALSE,FALSE\n6,1.野菜,刻みネギ：適量,FALSE,FALSE\n7,2.肉・魚,鶏もも肉：600g,FALSE,FALSE\n8,2.肉・魚,豚ロース：1350g,FALSE,FALSE\n9,2.肉・魚,鶏手羽元：24本（1440g）,FALSE,FALSE\n10,2.肉・魚,鶏ひき肉：450g,FALSE,FALSE\n11,3.その他,マカロニ：90g,FALSE,FALSE\n12,3.その他,バター：30g,FALSE,FALSE\n13,3.その他,薄力粉：大さじ9+30g,FALSE,FALSE\n14,3.その他,牛乳：600ml,FALSE,FALSE\n15,3.その他,ピザ用チーズ：60g,FALSE,FALSE\n16,3.その他,パン粉：大さじ3,FALSE,FALSE\n17,3.その他,生姜チューブ：18cm,FALSE,FALSE\n18,3.その他,砂糖：小さじ4.5+大さじ4.5+大さじ1.5+大さじ2,FALSE,FALSE\n19,3.その他,酒：大さじ4.5+大さじ2,FALSE,FALSE\n20,3.その他,醤油：大さじ9+大さじ3,FALSE,FALSE\n21,3.その他,みりん：大さじ9+大さじ3,FALSE,FALSE\n22,3.その他,ゆで卵：6個,FALSE,FALSE\n23,3.その他,ミツカン　味ぽん：3カップ,FALSE,FALSE\n24,3.その他,水：750ml+1.5カップ,FALSE,FALSE\n25,3.その他,しょうがすりおろし：小さじ1/2,FALSE,FALSE\n26,3.その他,卵：4個,FALSE,FALSE\n27,3.その他,ご飯：1500g,FALSE,FALSE\n28,3.その他,揚げ油：適量,FALSE,FALSE\n29,3.その他,めんつゆ（3倍濃縮）：大さじ6,FALSE,FALSE\n30,3.その他,塩：少々+小さじ1.5+小さじ1/3,FALSE,FALSE\n31,3.その他,こしょう：少々,FALSE,FALSE\n32,3.その他,穀物酢：75ml,FALSE,FALSE\n33,3.その他,赤唐辛子：1/2本,FALSE,FALSE\n34,3.その他,生パン粉：適量,FALSE,FALSE\n35,3.その他,サラダ油：大さじ1,FALSE,FALSE\n36,3.その他,カレールー：90g,FALSE,FALSE\n```\n"
  csvData = extractCsvFromGeminiText(testText);
  writeExtractedCsvToSheet(csvData, "write-test");  
}
