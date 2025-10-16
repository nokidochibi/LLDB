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
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Love Like Data Base')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * スプレッドシートの「アルバムグラフ」シートから、グラフ用の集計済みデータを取得します。
 * @return {Array<Object>} グラフ描画に必要なデータ配列。
 */
function getAlbumChartData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // 新しいシート名「アルバムグラフ」に変更
    const sheet = ss.getSheetByName('アルバムグラフ'); 
    if (!sheet) {
      Logger.log('シート「アルバムグラフ」が見つかりません');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // J列からR列までのデータを取得 (10列分)
    const data = sheet.getRange(2, 10, lastRow - 1, 9).getValues();

    const chartData = data
      .filter(row => safeTrim(row[0]) !== '1' && (parseInt(row[1]) || 0) > 0) // 無視フラグと演奏曲数0を除外
      .map(row => {
        return {
          albumName:   safeTrim(row[0]),
          totalPlays:  parseInt(row[1]) || 0,
          top1_song:   safeTrim(row[2]),
          top1_count:  parseInt(row[3]) || 0,
          top2_song:   safeTrim(row[4]),
          top2_count:  parseInt(row[5]) || 0,
          top3_song:   safeTrim(row[6]),
          top3_count:  parseInt(row[7]) || 0,
          others_count:parseInt(row[8]) || 0,
        };
      });
    return chartData;

  } catch (e) {
    Logger.log('アルバムグラフデータの取得エラー: ' + e.toString());
    return [];
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
 * スプレッドシートからライブ記録を取得します。
 * @return {Array<Object>} ライブ記録の配列。
 */
function getLiveRecords() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('記録');
    if (!sheet) { throw new Error('シート「記録」が見つかりません'); }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) { return []; }
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
      var tourName = safeTrim(row[4]);
      var dateRaw = row[7];
      if (!tourName || !dateRaw || !(dateRaw instanceof Date) || isNaN(dateRaw.getTime())) {
        return;
      }
      var year = dateRaw.getFullYear();
      var month = ('0' + (dateRaw.getMonth() + 1)).slice(-2);
      var day = ('0' + dateRaw.getDate()).slice(-2);
      var dateString = year + '/' + month + '/' + day;
      var dayOfWeek = weekDays[dateRaw.getDay()];
      var region = safeTrim(row[10]);
      var venue = safeTrim(row[11]);
      if (venue.includes('（オンライン）') || region === 'オンライン') {
        venue = 'オンライン';
        region = 'オンライン';
      }
      var setlist = [];
      var firstSong = safeTrim(row[12]);
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

