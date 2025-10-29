import { ExcelRow } from '@/types';

interface SQLQuery {
  select: string[];
  from: string;
  where?: string;
  groupBy?: string[];
  having?: string;
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
}

export class SQLEngine {
  private data: ExcelRow[];
  private headers: string[];

  constructor(data: ExcelRow[], headers: string[]) {
    this.data = data;
    this.headers = headers;
  }

  // Парсинг простого SQL
  parseSQL(sql: string): SQLQuery {
    const normalized = sql.trim().toUpperCase();
    
    // SELECT
    const selectMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/);
    const select = selectMatch ? selectMatch[1].split(',').map(s => s.trim()) : ['*'];

    // FROM (игнорируем, используем загруженные данные)
    const from = 'data';

    // WHERE
    const whereMatch = normalized.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/);
    const where = whereMatch ? whereMatch[1].trim() : undefined;

    // GROUP BY
    const groupByMatch = normalized.match(/GROUP BY\s+(.+?)(?:\s+HAVING|\s+ORDER BY|\s+LIMIT|$)/);
    const groupBy = groupByMatch ? groupByMatch[1].split(',').map(s => s.trim()) : undefined;

    // HAVING
    const havingMatch = normalized.match(/HAVING\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|$)/);
    const having = havingMatch ? havingMatch[1].trim() : undefined;

    // ORDER BY
    const orderByMatch = normalized.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|$)/);
    const orderBy = orderByMatch 
      ? orderByMatch[1].split(',').map(s => {
          const [column, direction] = s.trim().split(/\s+/);
          return { column, direction: (direction as 'ASC' | 'DESC') || 'ASC' };
        })
      : undefined;

    // LIMIT
    const limitMatch = normalized.match(/LIMIT\s+(\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1]) : undefined;

    return { select, from, where, groupBy, having, orderBy, limit };
  }

  // Выполнение запроса
  executeQuery(sql: string): ExcelRow[] {
    const query = this.parseSQL(sql);
    let result = [...this.data];

    // WHERE фильтрация
    if (query.where) {
      result = this.applyWhere(result, query.where);
    }

    // GROUP BY агрегация
    if (query.groupBy) {
      result = this.applyGroupBy(result, query.groupBy, query.select);
    } else {
      // SELECT проекция (если нет GROUP BY)
      result = this.applySelect(result, query.select);
    }

    // HAVING фильтрация после агрегации
    if (query.having) {
      result = this.applyWhere(result, query.having);
    }

    // ORDER BY сортировка
    if (query.orderBy) {
      result = this.applyOrderBy(result, query.orderBy);
    }

    // LIMIT ограничение
    if (query.limit) {
      result = result.slice(0, query.limit);
    }

    return result;
  }

  private applyWhere(data: ExcelRow[], condition: string): ExcelRow[] {
    const originalCondition = this.getOriginalCase(condition);
    
    return data.filter(row => {
      try {
        // Замена имён колонок на значения
        let expr = originalCondition;
        this.headers.forEach(header => {
          const value = row[header];
          const replacement = typeof value === 'string' ? `"${value}"` : String(value);
          expr = expr.replace(new RegExp(`\\b${header}\\b`, 'g'), replacement);
        });

        // Выполнение выражения
        return eval(expr);
      } catch (e) {
        return false;
      }
    });
  }

  private applySelect(data: ExcelRow[], columns: string[]): ExcelRow[] {
    if (columns.includes('*')) return data;

    return data.map(row => {
      const newRow: ExcelRow = {};
      columns.forEach(col => {
        const originalCol = this.getOriginalCase(col);
        
        // Обработка алиасов (AS)
        if (originalCol.includes(' AS ')) {
          const [expr, alias] = originalCol.split(' AS ').map(s => s.trim());
          newRow[alias] = this.evaluateExpression(row, expr);
        } else if (this.headers.includes(originalCol)) {
          newRow[originalCol] = row[originalCol];
        } else {
          // Вычисляемое поле
          newRow[originalCol] = this.evaluateExpression(row, originalCol);
        }
      });
      return newRow;
    });
  }

  private applyGroupBy(data: ExcelRow[], groupColumns: string[], selectColumns: string[]): ExcelRow[] {
    const groups = new Map<string, ExcelRow[]>();

    // Группировка
    data.forEach(row => {
      const key = groupColumns.map(col => row[this.getOriginalCase(col)]).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });

    // Агрегация
    return Array.from(groups.values()).map(group => {
      const newRow: ExcelRow = {};

      selectColumns.forEach(col => {
        const originalCol = this.getOriginalCase(col);
        
        if (originalCol.includes(' AS ')) {
          const [expr, alias] = originalCol.split(' AS ').map(s => s.trim());
          newRow[alias] = this.evaluateAggregation(group, expr);
        } else if (groupColumns.includes(col)) {
          newRow[originalCol] = group[0][originalCol];
        } else {
          newRow[originalCol] = this.evaluateAggregation(group, originalCol);
        }
      });

      return newRow;
    });
  }

  private applyOrderBy(data: ExcelRow[], orderBy: { column: string; direction: 'ASC' | 'DESC' }[]): ExcelRow[] {
    return [...data].sort((a, b) => {
      for (const { column, direction } of orderBy) {
        const col = this.getOriginalCase(column);
        const aVal = a[col] ?? 0;
        const bVal = b[col] ?? 0;

        if (aVal < bVal) return direction === 'ASC' ? -1 : 1;
        if (aVal > bVal) return direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  private evaluateExpression(row: ExcelRow, expr: string): any {
    try {
      let evaluatedExpr = expr;
      this.headers.forEach(header => {
        const value = row[header];
        const replacement = typeof value === 'string' ? `"${value}"` : String(value);
        evaluatedExpr = evaluatedExpr.replace(new RegExp(`\\b${header}\\b`, 'g'), replacement);
      });
      return eval(evaluatedExpr);
    } catch (e) {
      return null;
    }
  }

  private evaluateAggregation(group: ExcelRow[], expr: string): any {
    const upperExpr = expr.toUpperCase();

    // COUNT(*)
    if (upperExpr === 'COUNT(*)') {
      return group.length;
    }

    // COUNT(column)
    const countMatch = upperExpr.match(/COUNT\((.+?)\)/);
    if (countMatch) {
      const col = this.getOriginalCase(countMatch[1]);
      return group.filter(row => row[col] != null).length;
    }

    // SUM(column)
    const sumMatch = upperExpr.match(/SUM\((.+?)\)/);
    if (sumMatch) {
      const col = this.getOriginalCase(sumMatch[1]);
      return group.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
    }

    // AVG(column)
    const avgMatch = upperExpr.match(/AVG\((.+?)\)/);
    if (avgMatch) {
      const col = this.getOriginalCase(avgMatch[1]);
      const values = group.map(row => Number(row[col]) || 0);
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    // MIN(column)
    const minMatch = upperExpr.match(/MIN\((.+?)\)/);
    if (minMatch) {
      const col = this.getOriginalCase(minMatch[1]);
      return Math.min(...group.map(row => Number(row[col]) || 0));
    }

    // MAX(column)
    const maxMatch = upperExpr.match(/MAX\((.+?)\)/);
    if (maxMatch) {
      const col = this.getOriginalCase(maxMatch[1]);
      return Math.max(...group.map(row => Number(row[col]) || 0));
    }

    return null;
  }

  private getOriginalCase(column: string): string {
    const upperColumn = column.toUpperCase();
    return this.headers.find(h => h.toUpperCase() === upperColumn) || column;
  }
}
