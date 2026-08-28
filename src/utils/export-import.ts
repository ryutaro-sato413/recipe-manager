import { Recipe, Ingredient, Spice } from '../types';

interface ExportData {
  version: string;
  exportedAt: string;
  recipes: Recipe[];
  ingredients: Ingredient[];
  spices: Spice[];
}

export function exportData(recipes: Recipe[], ingredients: Ingredient[], spices: Spice[]): void {
  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    recipes,
    ingredients,
    spices,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recipe-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportData;
        if (!data.recipes || !data.ingredients || !data.spices) {
          reject(new Error('無効なファイル形式です'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('JSONの解析に失敗しました'));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}
