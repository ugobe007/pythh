import { setBootText, fatalBoot } from './boot-handlers';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from './components/ErrorBoundary';

setBootText('Loading… (react)');

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    fatalBoot('root-missing', new Error('#root not found'));
  } else {
    ReactDOM.createRoot(rootEl).render(
      <HelmetProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </HelmetProvider>
    );
    setBootText('Running…');
  }
} catch (e) {
  fatalBoot('render', e);
}
