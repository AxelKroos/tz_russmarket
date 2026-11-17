import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import { SchedulePage } from './components/schedule/schedule-page.js';
import './assets/styles/main.less';

createRoot(document.getElementById('root')!).render(<SchedulePage />);
