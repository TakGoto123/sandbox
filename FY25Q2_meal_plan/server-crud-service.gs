/**
 * SheetCrudService - A generic CRUD service for manipulating row-based data in Google Sheets.
 *
 * Assumes the sheet contains the following mandatory columns:
 * - id: A unique identifier in the format {appName}-{ISO8601 timestamp}
 * - deleted: A timestamp string indicating logical deletion (empty if not deleted)
 */
class SheetCrudService {
  constructor(sheetName, appName, primaryKey = 'id', deletedKey = 'deleted') {
    // Initialize spreadsheet and sheet reference
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = ss.getSheetByName(sheetName);
    if (!this.sheet) throw new Error(`Sheet not found: ${sheetName}`);

    this.appName = appName;
    this.primaryKey = primaryKey;
    this.deletedKey = deletedKey;
    this.headerMap = this._getHeaderMap();
  }

  // Retrieve a mapping from header names to column indices
  _getHeaderMap() {
    const headers = this.sheet.getRange(1, 1, 1, this.sheet.getLastColumn()).getValues()[0];
    return Object.fromEntries(headers.map((h, i) => [h, i]));
  }

  // Retrieve all rows (excluding header) as objects mapped by header names
  _getAllRows() {
    const values = this.sheet.getDataRange().getValues().slice(1);
    return values.map(row => Object.fromEntries(
      Object.entries(this.headerMap).map(([k, i]) => [k, row[i]])
    ));
  }

  /**
   * Get all rows optionally filtered.
   * @param {Object} options
   * @param {boolean} options.includeDeleted - Include rows with non-empty deleted field.
   * @param {Function|null} options.filter - Custom filter function.
   */
  getAll(includeDeleted = false, filter = null) {
    const rows = this._getAllRows();
    return rows.filter(item => {
      const isDeleted = !!item[this.deletedKey];
      if (!includeDeleted && isDeleted) return false;
      if (typeof filter === 'function') {
        return filter(item);
      }
      return true;
    });
  }

  // Find a row by its unique ID
  getById(id) {
    return this._getAllRows().find(item => item[this.primaryKey] === id);
  }

  /**
   * Create a new row in the sheet.
   * If id is not set, generates one. Always resets deleted flag.
   */
  create(item) {
    if (!item[this.primaryKey]) {
      item[this.primaryKey] = `${this.appName}-${new Date().toISOString()}`;
    }
    item[this.deletedKey] = '';

    const row = [];
    for (const [k, i] of Object.entries(this.headerMap)) {
      row[i] = item[k] || '';
    }

    this.sheet.appendRow(row);
    return item[this.primaryKey];
  }

  /**
   * Update a row by ID with new field values.
   */
  update(id, newValues) {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    const idIndex = this.headerMap[this.primaryKey];

    for (let r = 1; r < values.length; r++) {
      if (values[r][idIndex] === id) {
        for (const [k, v] of Object.entries(newValues)) {
          if (k in this.headerMap) {
            values[r][this.headerMap[k]] = v;
          }
        }
        this.sheet.getRange(r + 1, 1, 1, values[0].length).setValues([values[r]]);
        return true;
      }
    }
    return false;
  }

  /**
   * Logically delete a row by setting the deleted timestamp.
   */
  delete(id) {
    return this.update(id, { [this.deletedKey]: new Date().toISOString() });
  }

  /**
   * Physically delete a row from the sheet by ID.
   */
  hardDelete(id) {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    const idIndex = this.headerMap[this.primaryKey];

    for (let r = 1; r < values.length; r++) {
      if (values[r][idIndex] === id) {
        this.sheet.deleteRow(r + 1); // +1 because Spreadsheet rows are 1-based
        return true;
      }
    }
    return false;
  }

  /**
   * Physically delete multiple rows by ID.
   */
  bulkHardDelete(ids) {
    const dataRange = this.sheet.getDataRange();
    const values = dataRange.getValues();
    const idIndex = this.headerMap[this.primaryKey];
    const rowsToDelete = [];

    for (let r = 1; r < values.length; r++) {
      if (ids.includes(values[r][idIndex])) {
        rowsToDelete.push(r + 1); // row number in sheet (1-based)
      }
    }

    rowsToDelete.sort((a, b) => b - a); // delete from bottom
    for (const rowNum of rowsToDelete) {
      this.sheet.deleteRow(rowNum);
    }

    return rowsToDelete.length;
  }
}

// Example usage
function testCrud() {
  const repo = new SheetCrudService('shopping-list', 'shopping');

  const id = repo.create({ 
    date: "2025-07-24",
    category: "1.野菜",
    item: "人参10本",
    unnecessary: false,
    done: false
  });
  
  const item = repo.getById(id);
  item.item = 'じゃがいも10個'
  repo.update(id, item);
  repo.delete(id);

  const data1 = repo.getAll(true);
  const data2 = repo.getAll(false);

  return;
}
