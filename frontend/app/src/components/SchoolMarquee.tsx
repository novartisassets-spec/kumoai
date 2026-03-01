import { useEffect, useState } from 'react';

// School Marquee - Horizontal Infinite Scroll of Top African Schools
export function SchoolMarquee() {
  const schools = [
    "Loyola Jesuit College",
    "Grange School",
    "St. Andrews School, Turi",
    "Brookhouse School",
    "Lekki British School",
    "British International School Lagos",
    "Atlantic Hall",
    "Corona Schools",
    "Day Waterman College",
    "International School of Kenya",
    "Hilton College",
    "Greensteds International School"
  ];

  // Double the array for infinite effect
  const displaySchools = [...schools, ...schools];

  return (
    <div className="py-12 bg-black/20 border-y border-white/5 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#ffd700]/5 via-transparent to-[#ffd700]/5 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 mb-6">
        <p className="text-[10px] font-black text-[#ffd700]/40 uppercase tracking-[0.4em] text-center">
          Trusted by Elite Institutions Across the Continent
        </p>
      </div>

      {/* Marquee Container */}
      <div className="flex overflow-hidden relative">
        <div className="flex animate-marquee whitespace-nowrap gap-12 items-center py-4">
          {displaySchools.map((school, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 transition-all duration-500 hover:scale-110 cursor-default"
            >
              <div className="w-2 h-2 rounded-full bg-[#ffd700]/30 group-hover:bg-[#ffd700] transition-colors shadow-[0_0_8px_rgba(255,215,0,0.3)]" />
              <span className="text-white/40 group-hover:text-white/80 font-black text-sm md:text-base uppercase tracking-wider transition-colors">
                {school}
              </span>
            </div>
          ))}
        </div>
        
        {/* Second set for seamless loop handled by CSS animation */}
        <div className="flex animate-marquee2 absolute top-0 whitespace-nowrap gap-12 items-center py-4">
          {displaySchools.map((school, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 transition-all duration-500 hover:scale-110 cursor-default"
            >
              <div className="w-2 h-2 rounded-full bg-[#ffd700]/30 group-hover:bg-[#ffd700] transition-colors shadow-[0_0_8px_rgba(255,215,0,0.3)]" />
              <span className="text-white/40 group-hover:text-white/80 font-black text-sm md:text-base uppercase tracking-wider transition-colors">
                {school}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee2 {
          0% { transform: translateX(50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee2 {
          animation: marquee 40s linear infinite;
          left: 100%;
        }
        .group:hover .animate-marquee,
        .group:hover .animate-marquee2 {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
