import { ReactNode } from 'react';
import { ChefHat, Download, Upload, Settings, Cloud, CloudOff } from 'lucide-react';

type Page = 'recipes' | 'ingredients' | 'orders' | 'inventory' | 'settings';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
  onExport: () => void;
  onImport: (file: File) => void;
  isCloudConnected: boolean;
}

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'recipes', label: 'レシピ一覧' },
  { id: 'ingredients', label: '食材マスター' },
  { id: 'orders', label: 'オーダー管理' },
  { id: 'inventory', label: '棚卸管理' },
];

export default function Layout({ currentPage, onNavigate, children, onExport, onImport, isCloudConnected }: LayoutProps) {
  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onImport(file);
    };
    input.click();
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <ChefHat size={28} className="header-icon" />
          <div>
            <h1 className="header-title">レシピ管理ツール</h1>
            <p className="header-subtitle">飲食店向け原価計算システム</p>
          </div>
        </div>
        <div className="header-actions">
          {isCloudConnected ? (
            <span className="cloud-status cloud-status-on" title="クラウド同期中">
              <Cloud size={14} />同期中
            </span>
          ) : (
            <span className="cloud-status cloud-status-off" title="クラウド未接続">
              <CloudOff size={14} />未接続
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleImportClick}>
            <Upload size={16} />インポート
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onExport}>
            <Download size={16} />エクスポート
          </button>
          <button
            className={`btn btn-sm${currentPage === 'settings' ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => onNavigate('settings')}
            title="クラウド同期設定"
          >
            <Settings size={16} />設定
          </button>
        </div>
      </header>
      <nav className="app-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item${currentPage === item.id ? ' nav-item-active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}
