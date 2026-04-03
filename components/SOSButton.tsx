"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, PhoneCall, X, AlertCircle } from "lucide-react";

const EMERGENCY_NUMBERS: Record<
  string,
  { police: string; fire: string; ambulance: string; country: string }
> = {
  US: {
    police: "911",
    fire: "911",
    ambulance: "911",
    country: "United States",
  },
  UK: {
    police: "999",
    fire: "999",
    ambulance: "999",
    country: "United Kingdom",
  },
  FR: { police: "17", fire: "18", ambulance: "15", country: "France" },
  DEFAULT: {
    police: "112",
    fire: "112",
    ambulance: "112",
    country: "International",
  },
};

export function SOSButton({
  initialLocation = "US",
}: {
  initialLocation?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [locationCode, setLocationCode] = useState(initialLocation);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    // detect country by timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes("London") || tz.includes("Europe/London")) {
        setLocationCode("GB");
      } else if (tz.includes("Paris")) {
        setLocationCode("FR");
      } else if (tz.includes("America")) {
        setLocationCode("US");
      }
    } catch (e) {
      console.error("failed to detect location", e);
    }
    // Listen ONLY for the custom event to prevent double-firing
    window.addEventListener("open-sos", openModal);

    return () => {
      window.removeEventListener("open-sos", openModal);
    };
  }, [openModal]);

  const emergency =
    EMERGENCY_NUMBERS[locationCode] || EMERGENCY_NUMBERS.DEFAULT;

  return (
    <>
      {/* Floating Action Button - Only renders when modal is closed */}
      {!isOpen && (
        <button
          onClick={openModal}
          className="fixed bottom-8 right-8 w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center transition-all active:scale-90 z-60 border-4 border-white animate-pulse"
        >
          <ShieldAlert size={32} />
        </button>
      )}

      {/* Emergency Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-9999 flex flex-col items-center justify-center p-6">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-8 right-8 text-white/40 hover:text-white p-2 transition-colors"
          >
            <X size={48} />
          </button>

          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
              Emergency
            </h2>
            <p className="text-red-500 font-bold text-xl mt-2 tracking-widest">
              {emergency.country}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 w-full max-w-md">
            {[
              { type: "Police", num: emergency.police, color: "text-red-600" },
              {
                type: "Ambulance",
                num: emergency.ambulance,
                color: "text-blue-600",
              },
              { type: "Fire", num: emergency.fire, color: "text-orange-600" },
            ].map((svc) => (
              <button
                key={svc.type}
                onClick={() => (window.location.href = `tel:${svc.num}`)}
                className="bg-white w-full flex items-center justify-between p-8 rounded-[2.5rem] shadow-2xl active:scale-95 transition-transform group"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {svc.type}
                  </p>
                  <p className="text-4xl font-black text-black">{svc.num}</p>
                </div>
                <div
                  className={`${svc.color} p-4 rounded-full bg-gray-50 group-hover:bg-gray-100`}
                >
                  <PhoneCall size={36} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
