// lib/utils/translit.ts

export function transliterate(text: string): string {
  const ru: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 
    'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 
    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    ' ': '_', '-': '_'
  };

  return text
    .toLowerCase()
    .split('')
    .map(char => ru[char] || char) // Если есть в мапе - меняем, если нет - оставляем
    .join('')
    .replace(/[^a-z0-9_]/g, '') // Теперь удаляем всё, что не латиница, цифры или _
    .replace(/_+/g, '_');       // Убираем двойные подчеркивания
}