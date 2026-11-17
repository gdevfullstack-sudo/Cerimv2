import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChatbotWidget } from './components/ChatbotWidget';
import { CookieBanner } from './components/CookieBanner';
import { ToastContainer } from './components/ToastContainer';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { DetailPage } from './pages/DetailPage';
import { TrackingPage } from './pages/TrackingPage';
import { ContactPage } from './pages/ContactPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckinPage } from './pages/CheckinPage';
import { LegalPage } from './pages/LegalPage';

const AppShell: React.FC = () => {
  const { route } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F7F9] text-[#0F2233]">
      <Header />
      <main className="flex-1">
        {route.page === 'home' && <HomePage />}
        {route.page === 'recherche' && <SearchPage />}
        {route.page === 'detail' && <DetailPage />}
        {route.page === 'suivi' && <TrackingPage />}
        {route.page === 'contact' && <ContactPage />}
        {route.page === 'admin' && <DashboardPage />}
        {route.page === 'checkin' && <CheckinPage />}
        {route.page === 'legal' && <LegalPage />}
      </main>
      <Footer />
      <ChatbotWidget />
      <CookieBanner />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
