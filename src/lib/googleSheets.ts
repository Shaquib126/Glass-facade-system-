export const createAndPopulateSheet = async (
  accessToken: string,
  title: string,
  csvData: string
) => {
  // 1. Create a new Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error('Failed to create spreadsheet');
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // 2. Parse CSV (naive implementation for basic CSVs)
  const rows = csvData.split('\n').map(row => row.split(','));

  // 3. Update the spreadsheet with the data
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!updateRes.ok) {
    throw new Error('Failed to update spreadsheet data');
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
};
