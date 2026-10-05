import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { syncFromCloud } from './utils/cloud';
import { ALL_STORAGE_KEYS } from './utils/storage';

const root = createRoot(document.getElementById('root')!);

// クラウドから最新データを取得してから画面を表示する
root.render(
  <div className="app-loading">
    <div className="app-loading-spinner" />
    <p>データを読み込んでいます...</p>
  </div>
);

syncFromCloud(ALL_STORAGE_KEYS).then(ok => {
  root.render(
    <StrictMode>
      <App cloudSyncFailed={!ok} />
    </StrictMode>
  );
});
