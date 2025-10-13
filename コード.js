const ICON_IMG_ID = "1UZcq5cNyucsN8NUAM4hbBPwM7ZYf2W3t"; // アイコン画像ID

/**
 * 指定されたHTMLファイルの内容をインクルードします。
 * @param {string} filename インクルードするファイル名。
 * @return {string} ファイルの内容。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * GETリクエストを処理し、ウェブアプリのメインページを表示します。
 */
function doGet() {
  // HTMLを「テンプレート」として読み込むように変更
  const template = HtmlService.createTemplateFromFile('Index');
  
  // Base64に変換した画像データをHTML側に渡す
  template.iconImgData = getBase64Image(ICON_IMG_ID); 
  
  // テンプレートを評価してHTMLを生成
  return template.evaluate()
    .setTitle('Love Like Data Base')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Googleドライブ上の画像ファイルをBase64形式のデータURIに変換します。
 * @param {string} fileId 変換したい画像のファイルID。
 * @return {string} "data:image/png;base64,..." 形式の文字列。
 */
function getBase64Image(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const contentType = file.getMimeType(); // 画像のMIMEタイプを取得 (e.g., "image/png")
    const base64Data = Utilities.base64Encode(file.getBlob().getBytes());
    return `data:${contentType};base64,${base64Data}`;
  } catch (e) {
    Logger.log(`Base64画像の取得に失敗しました: ${e.toString()}`);
    // エラー時に返す代替データ（透明な1x1ピクセルのGIF）
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}


/**
 * 値を安全にトリミングして文字列として返します。
 * @param {*} value 処理する値。
 * @return {string} トリムされた文字列。
 */
function safeTrim(value) {
  if (value === null || typeof value === 'undefined') return '';
  return value.toString().trim().replace(/#VALUE!/g, '').trim();
}

/**

スプレッドシートからライブ記録を取得します。

@return {Array<Object>} ライブ記録の配列。
*/
function getLiveRecords() {
try {
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName('記録');

if (!sheet) {
throw new Error('シート「記録」が見つかりません');
}

var lastRow = sheet.getLastRow();
var lastCol = sheet.getLastColumn();

if (lastRow < 2) {
return [];
}

var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

var medleyColumns = [];
headers.forEach(function(header, i) {
var h = safeTrim(header);
if (h.includes('メドレー') && h.includes('曲目')) {
medleyColumns.push(i);
}
});

var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

var weekDays = ['日', '月', '火', '水', '木', '金', '土'];
var records = [];

data.forEach(function(row) {
var tourName = safeTrim(row[4]); // E列
var dateRaw = row[7]; // H列

if (!tourName || !dateRaw || !(dateRaw instanceof Date) || isNaN(dateRaw.getTime())) {
return; // 日付が無効な行はスキップ
}

var year = dateRaw.getFullYear();
var month = ('0' + (dateRaw.getMonth() + 1)).slice(-2);
var day = ('0' + dateRaw.getDate()).slice(-2);
var dateString = year + '/' + month + '/' + day;
var dayOfWeek = weekDays[dateRaw.getDay()];

var region = safeTrim(row[10]); // K列
var venue = safeTrim(row[11]); // L列

// オンラインライブの会場名を「オンライン」に統一
if (venue.includes('（オンライン）') || region === 'オンライン') {
venue = 'オンライン';
region = 'オンライン';
}

var setlist = [];
var firstSong = safeTrim(row[12]); // M列はインデックス12
if (firstSong) {
setlist.push(firstSong);
}

for (var j = 13; j < row.length; j++) {
if (medleyColumns.includes(j)) continue;

 var song = safeTrim(row[j]);
 if (song) {
   if (song.includes('メドレー')) {
     setlist.push('__MEDLEY_START__');
     medleyColumns.forEach(function(colIndex) {
       var medleySong = safeTrim(row[colIndex]);
       if (medleySong) {
         setlist.push(medleySong);
       }
     });
     setlist.push('__MEDLEY_END__');
   } else {
     setlist.push(song);
   }
 }

}

var songCount = setlist.filter(function(s) {
return s && !s.startsWith('_MEDLEY') && !s.includes('メドレー');
}).length;

records.push({
tourName: tourName,
date: dateString,
year: year,
dayOfWeek: dayOfWeek,
region: region,
venue: venue,
songCount: songCount,
setlist: setlist
});
});

return records;

} catch (e) {
Logger.log('データ取得エラー: ' + e.toString() + ' Stack: ' + e.stack);
throw new Error('データ取得エラー: ' + e.message);
}
}

/**

スプレッドシートからアルバムデータを取得します。

E列が1のアルバムは除外します。

@return {Array<Object>} アルバムデータの配列。
*/

function getAlbumData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('アルバム');
    
    if (!sheet) {
      return [];
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    // I列からK列まで取得 (無視フラグ, アルバム名, 演奏曲数)
    var data = sheet.getRange(2, 9, lastRow - 1, 3).getValues();
    
    return data
      .filter(function(row) {
        // I列（インデックス0）が '1' でないものをフィルタリング
        return safeTrim(row[0]) !== '1';
      })
      .map(function(row) {
        return {
          albumName: safeTrim(row[1]), // J列はインデックス1
          playCount: parseInt(row[2]) || 0 // K列はインデックス2
        };
      })
      .filter(function(item) {
        return item.albumName && item.playCount > 0;
      });
  } catch (e) {
    Logger.log('アルバムデータ取得エラー: ' + e.toString());
    return [];
  }
}