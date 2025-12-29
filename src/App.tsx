import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import remoteVideo from "@/assets/fake-call-remote.mp4";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const CallScreen = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Erro ao acessar a câmera:", error);
      }
    };

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-background text-foreground overflow-hidden relative">
      <video
        className="w-full h-full object-cover"
        src={remoteVideo}
        playsInline
        autoPlay
        loop
        muted
      />
      <video
        ref={localVideoRef}
        className="absolute top-4 right-4 w-24 h-40 rounded-xl border border-border shadow-lg object-cover bg-background/80"
        autoPlay
        muted
        playsInline
      />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CallScreen />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
