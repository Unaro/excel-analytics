'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';

export default function DataPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data) {
        setSheets(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">
          Нет загруженных данных. Загрузите Excel файл на главной странице.
        </p>
      </div>
    );
  }

  const currentSheet = sheets[selectedSheet];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Данные из Excel</h1>
      
      {sheets.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Выберите лист:</label>
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            {sheets.map((sheet, index) => (
              <option key={index} value={index}>
                {sheet.sheetName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table>
          <thead>
            <tr>
              {currentSheet.headers.map((header: string, index: number) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentSheet.rows.map((row: any, rowIndex: number) => (
              <tr key={rowIndex}>
                {currentSheet.headers.map((header: string, colIndex: number) => (
                  <td key={colIndex}>{row[header] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Всего строк: {currentSheet.rows.length}
      </div>
    </div>
  );
}
