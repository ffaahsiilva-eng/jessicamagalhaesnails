import { useState, lazy, Suspense } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import AuthModal from "@/components/AuthModal";
import InstallBanner from "@/components/InstallBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { AdminEditProvider } from "@/contexts/AdminEditContext";
import AdminEditToggle from "@/components/admin/AdminEditToggle";
import ErrorBoundary from "@/components/ErrorBoundary";
import SuspenseFallback from "@/components/SuspenseFallback";

// Lazy load components below the fold for better performance
const PriceTable = lazy(() => import("@/components/PriceTable"));
const Gallery = lazy(() => import("@/components/Gallery"));
const SocialLinks = lazy(() => import("@/components/SocialLinks"));
const Footer = lazy(() => import("@/components/Footer"));
const BookingCalendar = lazy(() => import("@/components/BookingCalendar"));
const GospelRadio = lazy(() => import("@/components/GospelRadio"));

const Index = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { getSetting } = useSiteSettings();

  // Get settings from database with fallbacks
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");
  const instagram = getSetting("instagram_url", "https://www.instagram.com/cantinho_da_je/");
  

  return (
    <AdminEditProvider>
      <div className="min-h-screen bg-background">
        <ConnectionStatus />
        
        <ErrorBoundary>
          <Navigation
            onLoginClick={() => setIsAuthOpen(true)}
            onBookClick={() => setIsBookingOpen(true)}
          />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Hero
            onBookClick={() => setIsBookingOpen(true)}
            whatsappNumber={whatsappNumber}
          />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback type="section" />}>
            <PriceTable />
          </Suspense>
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback type="section" />}>
            <Gallery />
          </Suspense>
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback type="component" />}>
            <SocialLinks
              instagram={instagram}
              whatsappNumber={whatsappNumber}
            />
          </Suspense>
        </ErrorBoundary>
        
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback type="component" />}>
            <Footer whatsappNumber={whatsappNumber} />
          </Suspense>
        </ErrorBoundary>

        <ErrorBoundary>
          <Suspense fallback={null}>
            <BookingCalendar
              isOpen={isBookingOpen}
              onClose={() => setIsBookingOpen(false)}
              whatsappNumber={whatsappNumber}
            />
          </Suspense>
        </ErrorBoundary>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
        />

        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <GospelRadio />
          </Suspense>
        </ErrorBoundary>
        
        <InstallBanner />
        
        <MobileBottomNav
          onBookClick={() => setIsBookingOpen(true)}
          whatsappNumber={whatsappNumber}
        />
        
        <AdminEditToggle />
      </div>
    </AdminEditProvider>
  );
};

export default Index;
