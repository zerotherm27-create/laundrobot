import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Force SW update check on every page load so tablets always get the latest build
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); });
  // Also re-check when the user switches back to the tab / wakes the screen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); });
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)