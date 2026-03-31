
// === BASIC MINIMAL FEATURES Apps Script Code ===
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const ss = sheet.getParent();

  const schemaSheetName = 'Schema';

  if (sheetName === schemaSheetName) {
    const editedColumn = range.getColumn();
    const editedRow = range.getRow();
    const tableColumn = 1;
    const fieldNameColumn = 2;

    if (editedColumn === tableColumn || editedColumn === fieldNameColumn) {
      const value = e.value;
      if (value) {
        const transformed = value.toLowerCase().replace(/\s+/g, '_');
        sheet.getRange(editedRow, editedColumn).setValue(transformed);
      }
    }
    return;
  }

  const schemaSheet = ss.getSheetByName(schemaSheetName);
  if (!schemaSheet) return;

  const schemaData = schemaSheet.getDataRange().getValues();
  const validSheetNames = new Set(schemaData.slice(1).map(row => row[0]).filter(Boolean));

  if (validSheetNames.has(sheetName)) {
    validateEditedCell(e, schemaData);
  }
}

function validateEditedCell(e, schemaData) {
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  const cell = sheet.getRange(row, col);
  const value = cell.getValue();
  const formula = cell.getFormula();

  if (row === 1) return;

  const schema = {};
  for (let i = 1; i < schemaData.length; i++) {
    const [tableName, fieldName, type, mode] = schemaData[i];
    if (!schema[tableName]) schema[tableName] = {};
    schema[tableName][fieldName] = { type, mode };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fieldName = headers[col - 1];
  const fieldSchema = schema[sheetName]?.[fieldName];
  if (!fieldSchema) return;

  const { type } = fieldSchema;

  if (type === 'FLOAT' && !formula && typeof value === 'string') {
    const reformattedFloat = reformatFloat(value);
    if (reformattedFloat !== null) {
      cell.setValue(reformattedFloat);
      cell.setNumberFormat("#,##0.00");
      return;
    }
  }

  if ((type === 'INTEGER' || type === 'FLOAT') && formula) {
    const isValid = validateDataType(value, type);
    if (!isValid) {
      cell.clearContent();
      SpreadsheetApp.getUi().alert(
        `Invalid formula result in ${sheetName}:\nRow: ${row}, Column: ${fieldName}\nExpected: ${type}, Found: ${typeof value}`
      );
    }
    return;
  }

  if (type === 'TIMESTAMP') {
    const parsedDateStr = normalizeDateToYMD(value);
    if (parsedDateStr) {
      cell.setValue(parsedDateStr);
    } else {
      cell.clearContent();
      SpreadsheetApp.getUi().alert(
        `Invalid TIMESTAMP format in ${sheetName}:\nRow: ${row}, Column: ${fieldName}\nExpected format: dd-mm-yyyy, yyyy-mm-dd, etc.`
      );
    }
    return;
  }

  const isValid = validateDataType(value, type);
  if (!isValid) {
    cell.clearContent();
    SpreadsheetApp.getUi().alert(
      `Invalid value in ${sheetName}:\nRow: ${row}, Column: ${fieldName}\nExpected: ${type}, Found: ${typeof value}`
    );
    return;
  }

  const updatedAtColIndex = headers.findIndex(h => String(h).toLowerCase().trim() === 'updated_at') + 1;
  if (updatedAtColIndex && col !== updatedAtColIndex) {
    const updatedAtCell = sheet.getRange(row, updatedAtColIndex);
    updatedAtCell.setValue(new Date());
  }
}

function validateDataType(value, expectedType) {
  if (value === null || value === '') return true;

  switch (expectedType) {
    case 'INTEGER':
      return Number.isInteger(Number(value));
    case 'FLOAT':
      return !isNaN(parseFloat(value));
    case 'STRING':
      return typeof value === 'string';
    case 'TIMESTAMP':
      return typeof value === 'string' && normalizeDateToYMD(value) !== null;
    case 'GEOGRAPHY':
      return typeof value === 'string' && value.startsWith('POINT');
    default:
      return false;
  }
}

function reformatFloat(value) {
  if (!value) return null;

  let str = String(value).trim();
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  if (commaCount === 1 && dotCount >= 1) {
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(',', '.');
  } else if (dotCount >= 2 && commaCount === 0) {
    const lastDot = str.lastIndexOf('.');
    str = str.slice(0, lastDot).replace(/\./g, '') + '.' + str.slice(lastDot + 1);
  }

  const floatVal = parseFloat(str);
  if (!isNaN(floatVal)) {
    return Math.round(floatVal * 100) / 100;
  }

  return null;
}

function normalizeDateToYMD(input) {
  if (!input) return null;

  if (Object.prototype.toString.call(input) === '[object Date]' && !isNaN(input)) {
    return Utilities.formatDate(input, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  if (typeof input === 'string') {
    const cleaned = input.trim().replace(/[./]/g, '-');
    const parts = cleaned.split('-');
    if (parts.length !== 3) return null;

    let day, month, year;

    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    }

    const isoString = `${year}-${month}-${day}`;
    const testDate = new Date(`${year}-${month}-${day}T00:00:00`);

    if (testDate.getFullYear() == year && testDate.getMonth() + 1 == Number(month) && testDate.getDate() == Number(day)) {
      return isoString;
    }

    return null;
  }

  return null;
}
            
