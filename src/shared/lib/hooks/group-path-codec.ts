// Кодек пути иерархии для URL.
//
// Компактно: в URL хранятся ТОЛЬКО значения уровней (value), соединённые «/».
// Остальные поля HierarchyFilterValue (levelId/levelIndex/columnName/
// displayValue) восстанавливаются из иерархии вызывающим — они избыточны в URL
// и раздували его в «простыню». Значения точные (идут в SQL-фильтр), в адресной
// строке читаемо («…/Москва/Центр»).
//
// Кодирование самих значений выполняет слой URL (URLSearchParams / Next), здесь
// только join/split по «/». Ограничение: значение, содержащее «/», не
// поддерживается (для категориальных уровней практически не встречается).
//
// Совместимость: распознаёт старый формат — JSON-массив объектов
// HierarchyFilterValue (старые ?path= и приходящий с дашборда ?filters=).

/** Значения уровней → строка для URL-параметра. */
export function encodePathValues(values: string[]): string {
  return values.join('/');
}

/**
 * Строка URL-параметра (уже декодированная слоем URL) → значения уровней.
 * Принимает и новый компактный формат, и легаси JSON-массив.
 */
export function decodePathValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  // Легаси JSON: ?filters= (single-encoded → «[…]») или старый ?path=
  // (double-encoded → «%5B…»).
  if (raw.startsWith('[') || raw.startsWith('%5B')) {
    try {
      const json = raw.startsWith('%') ? decodeURIComponent(raw) : raw;
      const arr = JSON.parse(json);
      if (Array.isArray(arr)) {
        return arr.map((f) => String(f?.value ?? '')).filter((v) => v !== '');
      }
    } catch {
      /* не JSON — упадём в split ниже */
    }
  }
  return raw.split('/').filter((v) => v !== '');
}
