/**
 * Unbroke — Google Sheets backend (Apps Script, container-bound).
 *
 * Deploy: Extensions → Apps Script → Deploy → New deployment → Web app
 *         Execute as: Me · Who has access: Anyone → copy the /exec URL into the app.
 *
 * The sheet is the source of truth. Every tab and column is created by `init`.
 * You can edit rows directly in the sheet; the app picks the change up within seconds.
 */

var API_VERSION = 2; // 2: adds the 'quick' action used by the iPhone Back Tap shortcut

var SCHEMA = {
  Transactions: ['ID', 'Date', 'Time', 'Amount', 'Category', 'Account', 'Note', 'Receipt', 'Source', 'Created', 'Updated'],
  Categories: ['ID', 'Name', 'Icon', 'Color', 'Order', 'Archived'],
  Accounts: ['ID', 'Name', 'Type', 'Icon', 'Color', 'Order', 'Archived'],
  Budgets: ['ID', 'Name', 'Period', 'Amount', 'Category', 'Created'],
  Scheduled: ['ID', 'Title', 'Amount', 'Category', 'Account', 'Note', 'Frequency', 'Interval', 'Start Date', 'End Date', 'Max Runs', 'Runs', 'Next Date', 'Active', 'Last Run', 'Created'],
  Settings: ['Key', 'Value']
};

// sheet header -> json key
var KEYS = {
  'ID': 'id', 'Date': 'date', 'Time': 'time', 'Amount': 'amount', 'Category': 'category', 'Account': 'account',
  'Note': 'note', 'Receipt': 'receipt', 'Source': 'source', 'Created': 'created', 'Updated': 'updated',
  'Name': 'name', 'Icon': 'icon', 'Color': 'color', 'Order': 'order', 'Archived': 'archived', 'Type': 'type',
  'Period': 'period', 'Title': 'title', 'Frequency': 'frequency', 'Interval': 'interval', 'Start Date': 'startDate',
  'End Date': 'endDate', 'Max Runs': 'maxRuns', 'Runs': 'runs', 'Next Date': 'nextDate', 'Active': 'active',
  'Last Run': 'lastRun', 'Key': 'key', 'Value': 'value'
};

var DATE_COLS = { 'Date': 1, 'Start Date': 1, 'End Date': 1, 'Next Date': 1 };
var DATETIME_COLS = { 'Created': 1, 'Updated': 1, 'Last Run': 1 };
var NUM_COLS = { 'Amount': 1, 'Order': 1, 'Interval': 1, 'Max Runs': 1, 'Runs': 1 };
var BOOL_COLS = { 'Archived': 1, 'Active': 1 };

var DEFAULT_CATEGORIES = [
  ['Food & Dining', 'utensils', '#eb6834'], ['Groceries', 'shopping-basket', '#1baf7a'],
  ['Shopping', 'shopping-bag', '#2a78d6'], ['Transport', 'car', '#eda100'],
  ['Travel', 'plane', '#6250d6'], ['Bills & Utilities', 'receipt', '#e34948'],
  ['Rent', 'home', '#008300'], ['Entertainment', 'clapperboard', '#e87ba4'],
  ['Subscriptions', 'repeat', '#2a78d6'], ['Health', 'heart-pulse', '#e34948'],
  ['Personal Care', 'sparkles', '#e87ba4'], ['Education', 'graduation-cap', '#6250d6'],
  ['Gifts', 'gift', '#1baf7a'], ['Others', 'circle-ellipsis', '#8e8e93']
];
var DEFAULT_ACCOUNTS = [['Cash', 'cash', 'banknote', '#1baf7a'], ['Bank', 'bank', 'landmark', '#2a78d6']];

/* ───────────────────────── HTTP ───────────────────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  return handle_(p.action || 'pull', p);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Bad JSON' }); }
  return handle_(body.action, body);
}

function handle_(action, p) {
  try {
    var out;
    switch (action) {
      case 'version': out = { version: version_() }; break;
      case 'init': out = init_(p); break;
      case 'pull': out = pull_(); break;
      case 'batch': out = batch_(p.ops || []); break;
      case 'upload': out = upload_(p); break;
      case 'runScheduled': runScheduled(); out = pull_(); break;
      case 'quick': out = quickAdd_(p.text); break;
      default: throw new Error('Unknown action: ' + action);
    }
    out.ok = true;
    out.api = API_VERSION;
    // Shortcuts can show a plain sentence directly in a notification
    if (p && p.format === 'text') return text_(out.message || 'Done');
    return json_(out);
  } catch (err) {
    var msg = String(err && err.message || err);
    if (p && p.format === 'text') return text_('⚠️ ' + msg);
    return json_({ ok: false, error: msg });
  }
}

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────────────── Setup ───────────────────────── */

function init_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (p && p.timeZone) { try { ss.setSpreadsheetTimeZone(p.timeZone); } catch (e) {} }
    Object.keys(SCHEMA).forEach(function (name) { ensureSheet_(ss, name); });

    var cats = ss.getSheetByName('Categories');
    if (cats.getLastRow() < 2) {
      var now = new Date();
      cats.getRange(2, 1, DEFAULT_CATEGORIES.length, 6).setValues(DEFAULT_CATEGORIES.map(function (c, i) {
        return [uid_(), c[0], c[1], c[2], i, false];
      }));
    }
    var accs = ss.getSheetByName('Accounts');
    if (accs.getLastRow() < 2) {
      accs.getRange(2, 1, DEFAULT_ACCOUNTS.length, 7).setValues(DEFAULT_ACCOUNTS.map(function (a, i) {
        return [uid_(), a[0], a[1], a[2], a[3], i, false];
      }));
    }
    var settings = ss.getSheetByName('Settings');
    if (settings.getLastRow() < 2) {
      settings.getRange(2, 1, 2, 2).setValues([['currency', 'INR'], ['weekStart', '1']]);
    }
    // remove the default empty "Sheet1" if it is still blank
    var s1 = ss.getSheetByName('Sheet1');
    if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);

    ensureTriggers_();
    bump_();
  } finally {
    lock.releaseLock();
  }
  return pull_();
}

function ensureSheet_(ss, name) {
  var headers = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (existing.join('') === '') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // append any missing columns (keeps user-added columns intact)
    headers.forEach(function (h) {
      if (existing.indexOf(h) === -1) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      }
    });
  }
  var cols = headerMap_(sh);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0B0B0F').setFontColor('#F5F5F7');
  Object.keys(cols).forEach(function (h) {
    var r = sh.getRange(2, cols[h] + 1, sh.getMaxRows() - 1, 1);
    if (DATE_COLS[h]) r.setNumberFormat('yyyy-mm-dd');
    else if (DATETIME_COLS[h]) r.setNumberFormat('yyyy-mm-dd hh:mm');
    else if (h === 'Time') r.setNumberFormat('hh:mm');
    else if (h === 'Amount') r.setNumberFormat('#,##0.00');
  });
  return sh;
}

function ensureTriggers_() {
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  if (!have.runScheduled) ScriptApp.newTrigger('runScheduled').timeBased().everyHours(1).create();
  if (!have.onSheetChange) ScriptApp.newTrigger('onSheetChange').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
}

/** Run once from the editor if you prefer to set up without the app. */
function setup() { init_({}); }

/* ───────────────────────── Change tracking ───────────────────────── */

function version_() {
  return PropertiesService.getScriptProperties().getProperty('version') || '0';
}
function bump_() {
  PropertiesService.getScriptProperties().setProperty('version', String(Date.now()));
}
// simple trigger: fires on manual edits in the sheet UI
function onEdit(e) { bump_(); }
// installable trigger: row inserts / deletes / pastes
function onSheetChange(e) { bump_(); }

/* ───────────────────────── Read ───────────────────────── */

function pull_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Transactions')) throw new Error('NOT_INITIALISED');
  processScheduled_(ss, false);
  normalise_(ss);
  var tz = ss.getSpreadsheetTimeZone();
  var settings = {};
  readTable_(ss, 'Settings', tz).forEach(function (r) { if (r.key) settings[r.key] = String(r.value); });
  return {
    version: version_(),
    timeZone: tz,
    transactions: readTable_(ss, 'Transactions', tz),
    categories: readTable_(ss, 'Categories', tz),
    accounts: readTable_(ss, 'Accounts', tz),
    budgets: readTable_(ss, 'Budgets', tz),
    scheduled: readTable_(ss, 'Scheduled', tz),
    settings: settings
  };
}

function headerMap_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  hdr.forEach(function (h, i) { if (h !== '' && map[h] === undefined) map[String(h).trim()] = i; });
  return map;
}

function readTable_(ss, name, tz) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var cols = headerMap_(sh);
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var out = [];
  values.forEach(function (row) {
    if (row.join('') === '') return;
    var o = {};
    Object.keys(cols).forEach(function (h) {
      var key = KEYS[h];
      if (!key) return;
      o[key] = fromCell_(h, row[cols[h]], tz);
    });
    out.push(o);
  });
  return out;
}

function fromCell_(h, v, tz) {
  if (v === '' || v === null || v === undefined) {
    if (BOOL_COLS[h]) return h === 'Active';
    return NUM_COLS[h] ? null : '';
  }
  if (DATE_COLS[h]) return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : parseLooseDate_(String(v), tz);
  if (DATETIME_COLS[h]) return v instanceof Date ? v.toISOString() : String(v);
  if (h === 'Time') return v instanceof Date ? Utilities.formatDate(v, tz, 'HH:mm') : String(v).slice(0, 5);
  if (NUM_COLS[h]) { var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
  if (BOOL_COLS[h]) return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'yes';
  return String(v);
}

function parseLooseDate_(s, tz) {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // dd/mm/yyyy
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  var d = new Date(s);
  return isNaN(d) ? s : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

/**
 * Fixes rows typed straight into the sheet: gives them an ID, a created stamp,
 * and adds unknown category / account names to their lists.
 */
function normalise_(ss) {
  var tx = ss.getSheetByName('Transactions');
  if (!tx || tx.getLastRow() < 2) return;
  var cols = headerMap_(tx);
  var n = tx.getLastRow() - 1;
  var idRange = tx.getRange(2, cols.ID + 1, n, 1);
  var ids = idRange.getValues();
  var dirty = false;
  var nowIso = new Date();
  var createdRange = tx.getRange(2, cols.Created + 1, n, 1);
  var created = createdRange.getValues();
  var amounts = tx.getRange(2, cols.Amount + 1, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (!ids[i][0] && amounts[i][0] !== '') {
      ids[i][0] = uid_();
      if (!created[i][0]) created[i][0] = nowIso;
      dirty = true;
    }
  }
  if (!dirty) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    idRange.setValues(ids);
    createdRange.setValues(created);
    addMissingNames_(ss, tx, cols);
    bump_();
  } finally { lock.releaseLock(); }
}

function addMissingNames_(ss, tx, cols) {
  var n = tx.getLastRow() - 1;
  if (n < 1) return;
  [['Category', 'Categories'], ['Account', 'Accounts']].forEach(function (pair) {
    var list = ss.getSheetByName(pair[1]);
    var lcols = headerMap_(list);
    var known = {};
    if (list.getLastRow() > 1) {
      list.getRange(2, lcols.Name + 1, list.getLastRow() - 1, 1).getValues().forEach(function (r) { known[String(r[0]).toLowerCase()] = 1; });
    }
    var used = tx.getRange(2, cols[pair[0]] + 1, n, 1).getValues();
    used.forEach(function (r) {
      var name = String(r[0]).trim();
      if (name && !known[name.toLowerCase()]) {
        known[name.toLowerCase()] = 1;
        var row = new Array(list.getLastColumn()).fill('');
        row[lcols.ID] = uid_(); row[lcols.Name] = name;
        if (lcols.Order !== undefined) row[lcols.Order] = list.getLastRow();
        if (lcols.Archived !== undefined) row[lcols.Archived] = false;
        if (lcols.Type !== undefined) row[lcols.Type] = 'other';
        list.appendRow(row);
      }
    });
  });
}

/* ───────────────────────── Write ───────────────────────── */

/**
 * ops: [{op:'upsert', table, row}, {op:'delete', table, id}, {op:'rename', table, from, to}]
 * Returns a fresh snapshot so the client needs a single round trip.
 */
function batch_(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var cache = {};
    var getT = function (name) {
      if (!SCHEMA[name]) throw new Error('Unknown table ' + name);
      if (!cache[name]) {
        var sh = ss.getSheetByName(name) || ensureSheet_(ss, name);
        var cols = headerMap_(sh);
        var idx = {};
        if (sh.getLastRow() > 1) {
          var keyCol = name === 'Settings' ? cols.Key : cols.ID;
          sh.getRange(2, keyCol + 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r, i) { if (r[0] !== '') idx[String(r[0])] = i + 2; });
        }
        cache[name] = { sh: sh, cols: cols, idx: idx, deletes: [] };
      }
      return cache[name];
    };

    ops.forEach(function (op) {
      var t = getT(op.table);
      if (op.op === 'upsert') {
        upsert_(t, op.table, op.row);
      } else if (op.op === 'delete') {
        var r = t.idx[String(op.id)];
        if (r) { t.deletes.push(r); delete t.idx[String(op.id)]; }
      } else if (op.op === 'rename') {
        renameEverywhere_(ss, op.table, op.from, op.to);
      }
    });

    Object.keys(cache).forEach(function (name) {
      var t = cache[name];
      t.deletes.sort(function (a, b) { return b - a; }).forEach(function (r) { t.sh.deleteRow(r); });
    });
    bump_();
  } finally {
    lock.releaseLock();
  }
  return pull_();
}

function upsert_(t, table, row) {
  var key = table === 'Settings' ? String(row.key) : String(row.id || '');
  if (!key) throw new Error('Row is missing an id');
  var width = t.sh.getLastColumn();
  var rowNum = t.idx[key];
  var cur;
  if (rowNum) cur = t.sh.getRange(rowNum, 1, 1, width).getValues()[0];
  else cur = new Array(width).fill('');
  Object.keys(t.cols).forEach(function (h) {
    var k = KEYS[h];
    if (!k || !(k in row)) return;
    cur[t.cols[h]] = toCell_(h, row[k]);
  });
  if (table === 'Transactions') {
    if (t.cols.Updated !== undefined) cur[t.cols.Updated] = new Date();
    if (t.cols.Created !== undefined && !cur[t.cols.Created]) cur[t.cols.Created] = new Date();
  }
  if (rowNum) {
    t.sh.getRange(rowNum, 1, 1, width).setValues([cur]);
  } else {
    t.sh.appendRow(cur);
    t.idx[key] = t.sh.getLastRow();
  }
}

function toCell_(h, v) {
  if (v === null || v === undefined) return '';
  // ISO date strings are parsed by Sheets in the spreadsheet's own time zone,
  // which avoids off-by-one days when the script and sheet time zones differ.
  if (DATE_COLS[h]) return v ? String(v).slice(0, 10) : '';
  if (DATETIME_COLS[h]) return v ? new Date(v) : '';
  if (h === 'Time') return v ? String(v) : '';
  if (NUM_COLS[h]) return v === '' ? '' : Number(v);
  if (BOOL_COLS[h]) return !!v;
  return v;
}

function renameEverywhere_(ss, table, from, to) {
  var col = table === 'Categories' ? 'Category' : table === 'Accounts' ? 'Account' : null;
  if (!col || !from || from === to) return;
  ['Transactions', 'Scheduled', 'Budgets'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var cols = headerMap_(sh);
    if (cols[col] === undefined) return;
    var rng = sh.getRange(2, cols[col] + 1, sh.getLastRow() - 1, 1);
    var vals = rng.getValues();
    var changed = false;
    vals.forEach(function (r) { if (String(r[0]) === from) { r[0] = to; changed = true; } });
    if (changed) rng.setValues(vals);
  });
}

/* ───────────────────────── Receipts ───────────────────────── */

function upload_(p) {
  if (!p.data) throw new Error('No file data');
  var folderName = 'Unbroke Receipts';
  var it = DriveApp.getFoldersByName(folderName);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
  var blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'image/jpeg', p.name || ('receipt-' + Date.now() + '.jpg'));
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { url: 'https://drive.google.com/file/d/' + file.getId() + '/view', fileId: file.getId() };
}

/* ───────────────────────── Scheduled / recurring ───────────────────────── */

/** Time-driven (hourly). Posts every scheduled expense that has come due. */
function runScheduled() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  processScheduled_(ss, true);
}

function processScheduled_(ss, wait) {
  var sh = ss.getSheetByName('Scheduled');
  if (!sh || sh.getLastRow() < 2) return;
  var lock = LockService.getScriptLock();
  if (wait) lock.waitLock(25000); else if (!lock.tryLock(3000)) return;
  try {
    var tz = ss.getSpreadsheetTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var cols = headerMap_(sh);
    var n = sh.getLastRow() - 1;
    var data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
    var tx = ss.getSheetByName('Transactions');
    var tcols = headerMap_(tx);
    var newRows = [];
    var changed = false;

    data.forEach(function (row, i) {
      var s = {};
      Object.keys(cols).forEach(function (h) { if (KEYS[h]) s[KEYS[h]] = fromCell_(h, row[cols[h]], tz); });
      if (!s.id || !s.active || !s.startDate || !s.amount) return;
      var runs = s.runs || 0;
      var guard = 0;
      var next = occurrence_(s, runs);
      var rowChanged = false;
      while (next && next <= today && guard++ < 500) {
        if (s.endDate && next > s.endDate) break;
        if (s.maxRuns && runs >= s.maxRuns) break;
        var r = new Array(tx.getLastColumn()).fill('');
        r[tcols.ID] = uid_();
        r[tcols.Date] = toCell_('Date', next);
        r[tcols.Time] = '09:00';
        r[tcols.Amount] = Number(s.amount);
        r[tcols.Category] = s.category || 'Others';
        r[tcols.Account] = s.account || '';
        r[tcols.Note] = s.title + (s.note ? ' · ' + s.note : '');
        r[tcols.Source] = 'scheduled:' + s.id;
        r[tcols.Created] = new Date();
        r[tcols.Updated] = new Date();
        newRows.push(r);
        runs++;
        rowChanged = true;
        if (s.frequency === 'once') break;
        next = occurrence_(s, runs);
      }
      var finished = (s.frequency === 'once' && runs >= 1) || (s.maxRuns && runs >= s.maxRuns) || (s.endDate && next && next > s.endDate);
      var nextVal = finished ? '' : toCell_('Date', next);
      var curNext = row[cols['Next Date']];
      var curNextStr = curNext instanceof Date ? Utilities.formatDate(curNext, tz, 'yyyy-MM-dd') : String(curNext || '');
      if (rowChanged || curNextStr !== (finished ? '' : next)) {
        row[cols.Runs] = runs;
        row[cols['Next Date']] = nextVal;
        if (rowChanged) row[cols['Last Run']] = new Date();
        if (finished) row[cols.Active] = false;
        changed = true;
      }
    });

    if (newRows.length) {
      tx.getRange(tx.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    if (changed) {
      sh.getRange(2, 1, n, data[0].length).setValues(data);
      bump_();
    }
  } finally {
    lock.releaseLock();
  }
}

/** The k-th occurrence date (0-based) of a schedule, as yyyy-MM-dd. */
function occurrence_(s, k) {
  var p = String(s.startDate).split('-').map(Number);
  var y = p[0], m = p[1] - 1, d = p[2];
  var iv = Math.max(1, Number(s.interval) || 1);
  var dt;
  switch (s.frequency) {
    case 'once': return k === 0 ? s.startDate : null;
    case 'daily': dt = new Date(y, m, d + k * iv); break;
    case 'weekly': dt = new Date(y, m, d + 7 * k * iv); break;
    case 'yearly': dt = clampDate_(y + k * iv, m, d); break;
    case 'monthly':
    default: dt = clampDate_(y, m + k * iv, d); break;
  }
  return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
}

function clampDate_(y, m, d) {
  var first = new Date(y, m, 1);
  var last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d, last));
}

/* ───────────────────────── Quick add from text (iPhone Back Tap shortcut) ───────────────────────── */

/**
 * Adds one expense from a sentence such as "swiggy 340 upi yesterday 9pm note team dinner".
 * Mirrors app/src/lib/quickadd.ts so the shortcut and the in-app quick add behave the same.
 */
function quickAdd_(text) {
  text = String(text || '').trim();
  if (!text) throw new Error('Say or type what you spent, e.g. "swiggy 340 upi"');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Transactions')) throw new Error('NOT_INITIALISED');
  var tz = ss.getSpreadsheetTimeZone();
  var cats = readTable_(ss, 'Categories', tz).filter(function (c) { return c.name && !c.archived; });
  var accs = readTable_(ss, 'Accounts', tz).filter(function (a) { return a.name && !a.archived; });
  var settings = {};
  readTable_(ss, 'Settings', tz).forEach(function (r) { if (r.key) settings[r.key] = String(r.value); });
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var nowTime = Utilities.formatDate(new Date(), tz, 'HH:mm');

  var p = parseQuick_(text, cats, accs, today);
  if (!p.amount) throw new Error('No amount found in "' + text + '". Try "chai 30".');

  var defAcc = '';
  var wanted = String(settings.defaultAccount || '').toLowerCase();
  accs.forEach(function (a) { if (!defAcc && a.name.toLowerCase() === wanted) defAcc = a.name; });
  if (!defAcc && accs.length) defAcc = accs[0].name;
  var category = p.category || (cats.filter(function (c) { return c.name.toLowerCase() === 'others'; })[0] || {}).name || 'Others';
  var account = p.account || defAcc;
  var time = p.time || (p.date === today ? nowTime : '12:00');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tx = ss.getSheetByName('Transactions');
    var cols = headerMap_(tx);
    var row = new Array(tx.getLastColumn()).fill('');
    var put = function (h, v) { if (cols[h] !== undefined) row[cols[h]] = v; };
    put('ID', uid_());
    put('Date', p.date);
    put('Time', time);
    put('Amount', p.amount);
    put('Category', category);
    put('Account', account);
    put('Note', p.note);
    put('Source', 'shortcut');
    put('Created', new Date());
    put('Updated', new Date());
    tx.appendRow(row);
    bump_();
  } finally {
    lock.releaseLock();
  }

  var when = p.date === today ? '' : ' · ' + Utilities.formatDate(new Date(p.date + 'T12:00:00'), tz, 'd MMM');
  var amt = '₹' + Number(p.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (String(settings.currency || 'INR') !== 'INR') amt = settings.currency + ' ' + Number(p.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return {
    message: '✓ Added ' + amt + ' · ' + category + (account ? ' · ' + account : '') + when + (p.note ? ' · ' + p.note : ''),
    transaction: { date: p.date, time: time, amount: p.amount, category: category, account: account, note: p.note }
  };
}

var QA_HINTS = {
  'Food & Dining': ['swiggy', 'zomato', 'lunch', 'dinner', 'breakfast', 'coffee', 'starbucks', 'cafe', 'restaurant', 'pizza', 'burger', 'food', 'tea', 'chai', 'snacks', 'dominos', 'kfc', 'mcd', 'biryani'],
  'Groceries': ['blinkit', 'zepto', 'bigbasket', 'grocery', 'groceries', 'vegetables', 'fruits', 'milk', 'instamart', 'dmart'],
  'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'clothes', 'shoes', 'shopping', 'nykaa'],
  'Transport': ['uber', 'ola', 'rapido', 'metro', 'auto', 'cab', 'petrol', 'diesel', 'fuel', 'bus', 'parking', 'toll'],
  'Travel': ['flight', 'train', 'irctc', 'hotel', 'airbnb', 'trip', 'makemytrip', 'goibibo'],
  'Bills & Utilities': ['electricity', 'water', 'gas', 'internet', 'wifi', 'broadband', 'recharge', 'mobile', 'bill', 'jio', 'airtel'],
  'Rent': ['rent'],
  'Entertainment': ['movie', 'pvr', 'inox', 'concert', 'game', 'bookmyshow', 'party'],
  'Subscriptions': ['netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'subscription', 'icloud', 'chatgpt'],
  'Health': ['medicine', 'pharmacy', 'doctor', 'hospital', 'gym', 'apollo', 'pharmeasy', 'health'],
  'Personal Care': ['haircut', 'salon', 'spa', 'grooming'],
  'Education': ['course', 'books', 'book', 'udemy', 'tuition', 'fees'],
  'Gifts': ['gift', 'donation', 'charity']
};
var QA_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
var QA_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
var QA_MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
var QA_FILLER = { add: 1, added: 1, spent: 1, spend: 1, paid: 1, pay: 1, bought: 1, 'for': 1, on: 1, at: 1, via: 1, from: 1, by: 1, using: 1, 'with': 1, the: 1, rs: 1, 'rs.': 1, inr: 1, '₹': 1 };

// date helpers on 'yyyy-MM-dd' strings (UTC maths, so no time-zone drift)
function qaPad_(n) { return (n < 10 ? '0' : '') + n; }
function qaKey_(y, m, d) { var t = new Date(Date.UTC(y, m, d)); return t.getUTCFullYear() + '-' + qaPad_(t.getUTCMonth() + 1) + '-' + qaPad_(t.getUTCDate()); }
function qaParts_(k) { var a = k.split('-'); return [Number(a[0]), Number(a[1]) - 1, Number(a[2])]; }
function qaAddDays_(k, n) { var p = qaParts_(k); return qaKey_(p[0], p[1], p[2] + n); }
function qaWeekday_(k) { var p = qaParts_(k); return new Date(Date.UTC(p[0], p[1], p[2])).getUTCDay(); }
function qaRecent_(day, month, year, today) {
  if (month < 0 || month > 11) return null;
  var t = qaParts_(today);
  var y = year === undefined ? t[0] : (year < 100 ? 2000 + year : year);
  var last = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
  if (day < 1 || day > last) return null;
  var k = qaKey_(y, month, day);
  if (year === undefined && k > today) k = qaKey_(y - 1, month, day);
  return k;
}
function qaTo24_(h, m, ap) {
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  }
  if (h > 23 || m > 59) return null;
  return qaPad_(h) + ':' + qaPad_(m);
}
function qaEval_(expr) {
  var s = String(expr).replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/,/g, '');
  if (!/^[0-9+\-*/.()]+$/.test(s)) return NaN;
  try {
    var v = Function('"use strict"; return (' + s + ')')(); // only digits and operators reach here
    return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  } catch (e) { return NaN; }
}

function parseQuick_(input, cats, accs, today) {
  var explicitNote = '';
  var body = String(input).trim();
  var nm = body.match(/(?:^|\s)notes?\s*[:\-–]?\s+(.*)$/i) || body.match(/(?:^|\s)notes?\s*:\s*(.*)$/i);
  if (nm) { explicitNote = nm[1].trim(); body = body.slice(0, nm.index).trim(); }
  var s = ' ' + body + ' ';
  var date = today, time = null;

  var take = function (re, fn) {
    var m = s.match(re);
    if (m && fn(m)) { s = s.replace(m[0], ' '); return true; }
    return false;
  };
  var setDate = function (k) { if (!k) return false; date = k; return true; };

  // time
  take(/\s(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, function (m) { return !!(time = qaTo24_(+m[1], +(m[2] || 0), m[3].toLowerCase())); });
  if (!time) take(/\s(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, function (m) { return !!(time = qaTo24_(+m[1], +m[2])); });
  if (!time) take(/\s(?:at\s+|@\s*)(\d{1,2})(?=\s)/i, function (m) {
    var h = +m[1];
    var evening = /dinner|night|party|drinks|beer|bar|movie|pub|club/i.test(input);
    return !!(time = qaTo24_((h >= 1 && h <= 7) || (evening && h >= 8 && h <= 11) ? h + 12 : h, 0));
  });
  if (!time) {
    var words = [[/\s(?:this\s+)?morning(?=\s)/i, '09:00'], [/\s(?:at\s+)?noon(?=\s)/i, '12:00'], [/\s(?:this\s+)?afternoon(?=\s)/i, '14:00'], [/\s(?:this\s+)?evening(?=\s)/i, '19:00'], [/\stonight(?=\s)/i, '21:00'], [/\s(?:at\s+)?night(?=\s)/i, '21:00'], [/\s(?:at\s+)?midnight(?=\s)/i, '00:00']];
    for (var w = 0; w < words.length; w++) if (take(words[w][0], function () { time = words[w][1]; return true; })) break;
  }

  // date
  take(/\s(?:on\s+)?(?:the\s+)?day\s+before\s+yesterday(?=\s)/i, function () { return setDate(qaAddDays_(today, -2)); }) ||
  take(/\s(?:on\s+)?(yesterday|yday|ytd)(?=\s)/i, function () { return setDate(qaAddDays_(today, -1)); }) ||
  take(/\s(?:on\s+)?today(?=\s)/i, function () { return setDate(today); }) ||
  take(/\s(\d{1,3})\s+days?\s+ago(?=\s)/i, function (m) { return setDate(qaAddDays_(today, -m[1])); }) ||
  take(/\s(?:a\s+|1\s+)?week\s+ago(?=\s)/i, function () { return setDate(qaAddDays_(today, -7)); }) ||
  take(/\slast\s+week(?=\s)/i, function () { return setDate(qaAddDays_(today, -7)); }) ||
  take(new RegExp('\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?' + QA_MONTH_RE + '\\.?(?:,?\\s+(\\d{2,4}))?(?=\\s)', 'i'), function (m) {
    return setDate(qaRecent_(+m[1], QA_MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), m[3] ? +m[3] : undefined, today));
  }) ||
  take(new RegExp('\\s(?:on\\s+)?' + QA_MONTH_RE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\s)', 'i'), function (m) {
    return setDate(qaRecent_(+m[2], QA_MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), m[3] ? +m[3] : undefined, today));
  }) ||
  take(/\s(?:on\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?=\s)/, function (m) { return setDate(qaRecent_(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined, today)); }) ||
  take(/\s(?:on\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?=\s)/, function (m) { return setDate(qaRecent_(+m[1], +m[2] - 1, +m[3], today)); }) ||
  take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/, function (m) { return setDate(qaRecent_(+m[3], +m[2] - 1, +m[1], today)); }) ||
  take(/\s(?:on\s+)?(last\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|urday|sday)?(?=\s)/i, function (m) {
    var key = m[2].toLowerCase().slice(0, 3), wi = -1;
    QA_WEEKDAYS.forEach(function (d, i) { if (d.indexOf(key) === 0) wi = i; });
    if (wi < 0) return false;
    var diff = (qaWeekday_(today) - wi + 7) % 7 || 7;
    return setDate(qaAddDays_(today, -diff));
  }) ||
  take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(st|nd|rd|th)(?=\s)/i, function (m) {
    var t = qaParts_(today);
    var k = qaRecent_(+m[1], t[1], t[0], today);
    if (k && k > today) { var pm = qaParts_(qaKey_(t[0], t[1] - 1, 1)); k = qaRecent_(+m[1], pm[1], pm[0], today); }
    return setDate(k);
  });

  // amount
  var toks = s.trim().split(/\s+/).filter(String);
  var amount = null;
  var idx = -1;
  for (var i = 0; i < toks.length && idx < 0; i++) if (/^(₹|rs\.?|inr)\s*\d/i.test(toks[i]) || /\d(₹|\/-|rs)$/i.test(toks[i])) idx = i;
  for (var j = 0; j < toks.length && idx < 0; j++) if (/^[\d.,+\-*/x×()]+$/i.test(toks[j]) && /\d/.test(toks[j]) && qaEval_(toks[j].replace(/^(₹|rs\.?|inr)/i, '').replace(/(₹|rs\.?|\/-)$/i, '')) > 0) idx = j;
  if (idx >= 0) {
    var v = qaEval_(toks[idx].replace(/^(₹|rs\.?|inr)/i, '').replace(/(₹|rs\.?|\/-)$/i, ''));
    if (v > 0) { amount = v; toks.splice(idx, 1); }
  }
  toks = toks.filter(function (t) { return !/^(₹|rs\.?|inr|\/-)$/i.test(t); });

  var lower = function (x) { return String(x).toLowerCase(); };
  var account = null, category = null;

  // account: full multi-word name first, then first word or type
  var joined = ' ' + lower(toks.join(' ')) + ' ';
  var sorted = accs.slice().sort(function (a, b) { return b.name.length - a.name.length; });
  for (var a = 0; a < sorted.length && !account; a++) {
    if (joined.indexOf(' ' + lower(sorted[a].name) + ' ') >= 0) {
      account = sorted[a].name;
      var n = sorted[a].name.split(/\s+/).length;
      for (var k = 0; k + n <= toks.length; k++) if (lower(toks.slice(k, k + n).join(' ')) === lower(account)) { toks.splice(k, n); break; }
    }
  }
  for (var b = 0; b < toks.length && !account; b++) {
    var w0 = lower(toks[b]);
    for (var c = 0; c < accs.length; c++) {
      if (lower(accs[c].name).split(/\s+/)[0] === w0 || lower(accs[c].type) === w0) { account = accs[c].name; toks.splice(b, 1); break; }
    }
  }

  // category: explicit name first, then keyword hints (also looking at the note)
  for (var d = 0; d < toks.length && !category; d++) {
    var w1 = lower(toks[d]).replace(/^#/, '');
    for (var e = 0; e < cats.length; e++) {
      var cn = lower(cats[e].name);
      if (cn === w1 || cn.split(/[\s&]+/)[0] === w1) { category = cats[e].name; toks.splice(d, 1); break; }
    }
  }
  if (!category) {
    var all = lower(toks.join(' ') + ' ' + explicitNote);
    for (var cat in QA_HINTS) {
      if (category) break;
      var exists = cats.filter(function (x) { return lower(x.name) === lower(cat); })[0];
      if (!exists) continue;
      for (var h = 0; h < QA_HINTS[cat].length; h++) {
        if (new RegExp('\\b' + QA_HINTS[cat][h] + '\\b').test(all)) { category = exists.name; break; }
      }
    }
  }

  var cap = function (x) { return x.charAt(0).toUpperCase() + x.slice(1); };
  var rest = cap(toks.filter(function (t) { return !QA_FILLER[lower(t)]; }).join(' '));
  var note = explicitNote ? (rest ? rest + ' · ' + explicitNote : cap(explicitNote)) : rest;
  return { amount: amount, category: category, account: account, date: date, time: time, note: note };
}

/* ───────────────────────── utils ───────────────────────── */

function uid_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}
