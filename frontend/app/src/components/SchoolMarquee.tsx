// Refined School Marquee - Compact, Classic & Luxurious
export function SchoolMarquee() {
  const schools = [
    { name: "Loyola Jesuit College", initials: "LJC", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "Grange School", initials: "GS", color: "from-[#7dd3c0] to-[#5fb3a0]" },
    { name: "St. Andrews School, Turi", initials: "SAS", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "Brookhouse School", initials: "BS", color: "from-[#7dd3c0] to-[#5fb3a0]" },
    { name: "Lekki British School", initials: "LBS", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "British International School Lagos", initials: "BIS", color: "from-[#7dd3c0] to-[#5fb3a0]" },
    { name: "Atlantic Hall", initials: "AH", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "Corona Schools", initials: "CS", color: "from-[#7dd3c0] to-[#5fb3a0]" },
    { name: "Day Waterman College", initials: "DWC", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "International School of Kenya", initials: "ISK", color: "from-[#7dd3c0] to-[#5fb3a0]" },
    { name: "Hilton College", initials: "HC", color: "from-[#ffd700] to-[#ffed4e]" },
    { name: "Greensteds International School", initials: "GIS", color: "from-[#7dd3c0] to-[#5fb3a0]" }
  ];

  // Repeat schools for a long enough line
  const displaySchools = [...schools, ...schools, ...schools];

  return (
    <section className="py-12 bg-[#4a4f55] relative overflow-hidden border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6 mb-8 relative z-10">
        <p className="text-[10px] font-black text-[#ffd700]/60 uppercase tracking-[0.4em] text-center">
          Trusted by Elite Institutions
        </p>
      </div>

      {/* Marquee Wrapper */}
      <div className="relative flex overflow-hidden marquee-container">
        <div className="flex animate-scroll whitespace-nowrap gap-6 py-2">
          {displaySchools.map((school, index) => (
            <div 
              key={index}
              className="inline-flex items-center gap-4 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#ffd700]/30 transition-all duration-300 group cursor-default"
            >
              {/* Logo Circle */}
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${school.color} p-[1px] flex-shrink-0 shadow-lg shadow-black/20`}>
                <div className="w-full h-full bg-[#4a4f55] rounded-full flex items-center justify-center text-[8px] font-black text-white/90">
                  {school.initials}
                </div>
              </div>
              
              <span className="text-white/70 group-hover:text-white font-bold text-xs md:text-sm tracking-tight transition-colors">
                {school.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .marquee-container {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-33.33% - 24px)); } /* 33.33% because we have 3 sets */
        }

        .animate-scroll {
          animation: scroll 60s linear infinite;
          display: flex;
          width: fit-content;
        }

        .marquee-container:hover .animate-scroll {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
