/**
 * App entry point. Mounts React and resumes any autosaved game before render.
 * No game logic here.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { tryResume } from './state/gameStore';
import './ui/styles.css';

tryResume();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
