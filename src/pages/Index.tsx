import { useState } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import PriceTable from "@/components/PriceTable";
import Gallery from "@/components/Gallery";
import SocialLinks from "@/components/SocialLinks";
import Footer from "@/components/Footer";
import BookingCalendar from "@/components/BookingCalendar";
import AuthModal from "@/components/AuthModal";
import GospelRadio from "@/components/GospelRadio";
import InstallBanner from "@/components/InstallBanner";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { getSetting } = useSiteSettings();

  // Get settings from database with fallbacks
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");
  const instagram = getSetting("instagram_url", "https://instagram.com/glamournails");
  const facebook = getSetting("facebook_url", "https://facebook.com/glamournails");

  return (
    <div className="min-h-screen bg-background">
      <ConnectionStatus />
      <Navigation
        onLoginClick={() => setIsAuthOpen(true)}
        onBookClick={() => setIsBookingOpen(true)}
      />
      
      <Hero
        onBookClick={() => setIsBookingOpen(true)}
        whatsappNumber={whatsappNumber}
      />
      
      <PriceTable />
      
      <Gallery />
      
      <SocialLinks
        instagram={instagram}
        facebook={facebook}
        whatsappNumber={whatsappNumber}
      />
      
      <Footer whatsappNumber={whatsappNumber} />

      <BookingCalendar
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        whatsappNumber={whatsappNumber}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <GospelRadio />
      
      <InstallBanner />
    </div>
  );
};

export default Index;
