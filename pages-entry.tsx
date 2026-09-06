import {createRoot} from 'react-dom/client';
import Home from './app/page';
import './app/globals.css';
import './app/filters.css';
(window as unknown as {PAGES_BUILD:boolean}).PAGES_BUILD=true;
createRoot(document.getElementById('root')!).render(<Home/>);
