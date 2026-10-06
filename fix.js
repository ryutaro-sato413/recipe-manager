const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldEffect =   useEffect(() => {
    if (cloudSyncFailed) {
      addToast('クラウドからの読み込みに失敗しました。この端末のデータを表示しています。', 'error');
    }
    const onError = (e: Event) => addToast((e as CustomEvent<string>).detail, 'error');
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    return () => window.removeEventListener(SYNC_ERROR_EVENT, onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);;

const newEffect =   useEffect(() => {
    if (cloudSyncFailed) {
      addToast('クラウドからの読み込みに失敗しました。この端末のデータを表示しています。', 'error');
    }
    const onError = (e: Event) => addToast((e as CustomEvent<string>).detail, 'error');
    window.addEventListener(SYNC_ERROR_EVENT, onError);

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud(ALL_STORAGE_KEYS).then(ok => {
          if (ok) {
            setRecipes(getRecipes());
            setIngredients(getIngredients());
            setSpices(getSpices());
            setBeverages(getBeverages());
          }
        });
      }
    };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener(SYNC_ERROR_EVENT, onError);
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);;

if (content.includes(oldEffect)) {
    content = content.replace(oldEffect, newEffect);
    fs.writeFileSync('src/App.tsx', content, 'utf8');
    console.log('Replaced successfully');
} else {
    console.log('Could not find oldEffect');
    // Let's print the actual oldEffect to see what it is
    const lines = content.split('\n');
    console.log(lines.slice(23, 33).join('\n'));
}
