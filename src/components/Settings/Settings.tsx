import { useState } from 'react';
import { Cloud, CloudOff, Save, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  FirebaseConfig,
  getStoredConfig,
  getShopCode,
  saveStoredConfig,
  saveShopCode,
  clearStoredConfig,
  initFirebase,
} from '../../lib/firebase';
import {
  loadAllFromCloud,
  migrateLocalToCloud,
} from '../../lib/cloudStorage';
import { Recipe, Ingredient, Spice, Order, Inventory } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';

interface SettingsProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  spices: Spice[];
  orders: Order[];
  inventories: Inventory[];
  onCloudLoad: (data: {
    recipes: Recipe[];
    ingredients: Ingredient[];
    spices: Spice[];
    orders: Order[];
    inventories: Inventory[];
  }) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyConfig(): FirebaseConfig {
  return {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  };
}

export default function Settings({
  recipes, ingredients, spices, orders, inventories,
  onCloudLoad, addToast,
}: SettingsProps) {
  const existingConfig = getStoredConfig();
  const existingCode = getShopCode();

  const [config, setConfig] = useState<FirebaseConfig>(existingConfig || emptyConfig());
  const [shopCode, setShopCode] = useState(existingCode);
  const [isConnected, setIsConnected] = useState(!!existingConfig && !!existingCode);
  const [isTesting, setIsTesting] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const isConfigFilled = Object.values(config).every(v => v.trim() !== '') && shopCode.trim() !== '';

  const handleSave = async () => {
    if (!isConfigFilled) { addToast('すべての項目を入力してください', 'error'); return; }
    setIsTesting(true);
    try {
      initFirebase(config);
      saveStoredConfig(config);
      saveShopCode(shopCode);

      // クラウドからデータ読み込み
      const cloudData = await loadAllFromCloud(shopCode.trim().toLowerCase().replace(/\s+/g, '-'));

      if (
        cloudData.recipes.length === 0 &&
        cloudData.ingredients.length === 0 &&
        (recipes.length > 0 || ingredients.length > 0)
      ) {
        // クラウドにデータがなく、ローカルにデータがある → 自動移行
        await migrateLocalToCloud(shopCode.trim().toLowerCase().replace(/\s+/g, '-'), {
          recipes, ingredients, spices, orders, inventories,
        });
        addToast('クラウドに接続し、既存データを同期しました ✅', 'success');
      } else {
        // クラウドのデータを読み込む
        onCloudLoad(cloudData);
        addToast('クラウドに接続し、データを読み込みました ✅', 'success');
      }

      setIsConnected(true);
    } catch (e) {
      addToast(`接続に失敗しました: ${(e as Error).message}`, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredConfig();
    setConfig(emptyConfig());
    setShopCode('');
    setIsConnected(false);
    setShowDisconnect(false);
    addToast('クラウド接続を解除しました', 'info');
  };

  const handleMigrate = async () => {
    setIsTesting(true);
    try {
      await migrateLocalToCloud(shopCode.trim().toLowerCase().replace(/\s+/g, '-'), {
        recipes, ingredients, spices, orders, inventories,
      });
      addToast('現在のデータをクラウドに同期しました ✅', 'success');
    } catch (e) {
      addToast(`同期失敗: ${(e as Error).message}`, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const setField = (key: keyof FirebaseConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(c => ({ ...c, [key]: e.target.value.trim() }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">クラウド同期設定</h2>
        {isConnected ? (
          <span className="cloud-badge cloud-badge-on">
            <CheckCircle size={14} />クラウド同期中
          </span>
        ) : (
          <span className="cloud-badge cloud-badge-off">
            <CloudOff size={14} />未接続（端末内保存）
          </span>
        )}
      </div>

      <div className="settings-info-card">
        <h3 className="settings-info-title">📱 スマートフォンとPCでデータを共有するには</h3>
        <ol className="settings-steps">
          <li>
            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
              Firebase Console
            </a>
            を開き、Googleアカウントでログイン
          </li>
          <li>「プロジェクトを作成」→ プロジェクト名を入力（例: my-restaurant）→ 作成</li>
          <li>左メニュー「構築」→「Firestore Database」→「データベースの作成」→「テストモード」で開始</li>
          <li>左メニュー「プロジェクトの概要」→ ウェブアプリ追加ボタン（&lt;/&gt;）→ アプリ登録</li>
          <li>表示された <code>firebaseConfig</code> の各値を下記に入力</li>
          <li>「店舗コード」を決めて入力（スマホでも同じコードを使用）</li>
          <li>「保存して接続」ボタンをクリック</li>
        </ol>
      </div>

      {isConnected && (
        <div className="settings-connected-card">
          <CheckCircle size={20} className="settings-connected-icon" />
          <div>
            <strong>クラウド同期が有効です</strong>
            <p>店舗コード: <code>{getShopCode()}</code></p>
            <p className="settings-connected-note">スマートフォンで同じFirebase設定と店舗コードを入力すると、データが共有されます。</p>
          </div>
        </div>
      )}

      <div className="settings-form-card">
        <h3 className="settings-form-title">
          <Cloud size={18} />Firebase 設定
        </h3>

        <div className="form-group">
          <label className="form-label">店舗コード <span className="required">*</span></label>
          <input className="form-input" value={shopCode}
            onChange={e => setShopCode(e.target.value)}
            placeholder="例: myrestaurant（半角英数字）" />
          <p className="settings-hint">すべての端末で同じコードを使用してください</p>
        </div>

        <div className="settings-divider">Firebase Config（Firebase Consoleからコピー）</div>

        {([ 
          ['apiKey', 'API Key'],
          ['authDomain', 'Auth Domain'],
          ['projectId', 'Project ID'],
          ['storageBucket', 'Storage Bucket'],
          ['messagingSenderId', 'Messaging Sender ID'],
          ['appId', 'App ID'],
        ] as [keyof FirebaseConfig, string][]).map(([key, label]) => (
          <div className="form-group" key={key}>
            <label className="form-label">{label} <span className="required">*</span></label>
            <input className="form-input" value={config[key]} onChange={setField(key)}
              placeholder={`${label}を入力`} />
          </div>
        ))}

        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isConfigFilled || isTesting}
          >
            <Save size={16} />
            {isTesting ? '接続中...' : '保存して接続'}
          </button>

          {isConnected && (
            <>
              <button className="btn btn-secondary" onClick={handleMigrate} disabled={isTesting}>
                <Cloud size={16} />
                現在のデータを同期
              </button>
              <button className="btn btn-icon btn-icon-danger" onClick={() => setShowDisconnect(true)}>
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>

        {!isConfigFilled && (
          <p className="settings-warning">
            <AlertTriangle size={14} />すべての項目を入力してください
          </p>
        )}
      </div>

      {showDisconnect && (
        <ConfirmDialog
          message="クラウド接続を解除しますか？端末内のデータは保持されます。"
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnect(false)}
        />
      )}
    </div>
  );
}
