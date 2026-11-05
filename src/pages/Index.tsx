import { useState } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import PriceTable from "@/components/PriceTable";
import Gallery from "@/components/Gallery";
import SocialLinks from "@/components/SocialLinks";
import Footer from "@/components/Footer";
import BookingCalendar from "@/components/BookingCalendar";
import AuthModal from "@/components/AuthModal";
import InstallBanner from "@/components/InstallBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import AdminEditToggle from "@/components/admin/AdminEditToggle";
import ErrorBoundary from "@/components/ErrorBoundary";

const Index = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { getSetting } = useSiteSettings();

  // Get settings from database with fallbacks
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");
  const instagram = getSetting("instagram_url", "https://www.instagram.com/jessica_magalhaes_nail");

  return (
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
        <PriceTable />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <Gallery />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <SocialLinks
          instagram={instagram}
          whatsappNumber={whatsappNumber}
        />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <Footer whatsappNumber={whatsappNumber} />
      </ErrorBoundary>

      <ErrorBoundary>
        <BookingCalendar
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          whatsappNumber={whatsappNumber}
        />
      </ErrorBoundary>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
      
      <InstallBanner />
      
      <MobileBottomNav
        onBookClick={() => setIsBookingOpen(true)}
        whatsappNumber={whatsappNumber}
      />
      
      <AdminEditToggle />
    </div>
  );
};

export default Index;
