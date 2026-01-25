import { useState } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import PriceTable from "@/components/PriceTable";
import Gallery from "@/components/Gallery";
import SocialLinks from "@/components/SocialLinks";
import Footer from "@/components/Footer";
import BookingCalendar from "@/components/BookingCalendar";
import AuthModal from "@/components/AuthModal";

// Configurações do negócio - altere conforme necessário
const WHATSAPP_NUMBER = "5591918371798";
const INSTAGRAM = "https://instagram.com/glamournails";
const FACEBOOK = "https://facebook.com/glamournails";

const Index = () => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        onLoginClick={() => setIsAuthOpen(true)}
        onBookClick={() => setIsBookingOpen(true)}
      />
      
      <Hero
        onBookClick={() => setIsBookingOpen(true)}
        whatsappNumber={WHATSAPP_NUMBER}
      />
      
      <PriceTable />
      
      <Gallery />
      
      <SocialLinks
        instagram={INSTAGRAM}
        facebook={FACEBOOK}
        whatsappNumber={WHATSAPP_NUMBER}
      />
      
      <Footer whatsappNumber={WHATSAPP_NUMBER} />

      <BookingCalendar
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        whatsappNumber={WHATSAPP_NUMBER}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
};

export default Index;
