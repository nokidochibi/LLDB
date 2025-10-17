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
 * HTMLをテンプレートとして評価し、正しく表示されるようにします。
 */
function doGet() {
  // HTMLを「テンプレート」として読み込み、評価（evaluate）する
  return HtmlService.createTemplateFromFile('Index')
      .evaluate() // ← 最も重要なのがこの .evaluate() です！
      .setTitle('Love Like Data Base')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
 * スプレッドシートからライブ記録を取得します。
 * @return {Array<Object>} ライブ記録の配列。
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
 * スプレッドシートから積み上げグラフ用のアルバムデータを取得します。
 * @return {Array<Object>} アルバムデータの配列。
 */
function getAlbumData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('アルバムグラフ');
    
    if (!sheet) {
      Logger.log('シート「アルバムグラフ」が見つかりません');
      return [];
    }
    
    var lastRow = sheet.getLastRow();
    Logger.log('lastRow: ' + lastRow);
    
    if (lastRow < 2) {
      Logger.log('データ行がありません');
      return [];
    }
    
    // J列(10)からR列(18)まで（9列）取得
    var data = sheet.getRange(2, 10, lastRow - 1, 9).getValues();
    Logger.log('取得したデータ行数: ' + data.length);
    
    var result = data
      .filter(function(row) {
        var hasName = safeTrim(row[0]) !== '';
        var hasCount = (parseInt(row[1], 10) || 0) > 0;
        return hasName && hasCount;
      })
      .map(function(row) {
        var item = {
          albumName: safeTrim(row[0]),           // J列: アルバム名
          totalCount: parseInt(row[1], 10) || 0, // K列: 合計演奏回数
          rank1Count: parseInt(row[3], 10) || 0, // M列: 1位回数
          rank2Count: parseInt(row[5], 10) || 0, // O列: 2位回数
          rank3Count: parseInt(row[7], 10) || 0, // Q列: 3位回数
          otherCount: parseInt(row[8], 10) || 0  // R列: その他回数
        };
        Logger.log('処理したアルバム: ' + JSON.stringify(item));
        return item;
      });
    
    Logger.log('返却するアルバム数: ' + result.length);
    return result;
    
  } catch (e) {
    Logger.log('アルバムグラフデータ取得エラー: ' + e.toString() + '\nStack: ' + e.stack);
    return [];
  }
}