import { useEffect, useState } from 'react';
import { Table } from '../ui/table';
import { PreviewData } from '@/types';

interface SpreadsheetPreviewProps {
  preview: PreviewData;
  className?: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

export function SpreadsheetPreview({ preview, className }: SpreadsheetPreviewProps) {
  if (preview.type !== 'spreadsheet' || !preview.content) return null;

  const data: TableData = JSON.parse(preview.content);

  return (
    <div className={className}>
      <div className="max-h-48 overflow-auto rounded-lg border">
        <Table>
          <thead>
            <tr>
              {data.headers.map((header, index) => (
                <th
                  key={index}
                  className="border-b bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 5).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-b p-2 text-xs"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        {data.rows.length > 5 && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            {data.rows.length - 5} more rows...
          </div>
        )}
      </div>
    </div>
  );
}
