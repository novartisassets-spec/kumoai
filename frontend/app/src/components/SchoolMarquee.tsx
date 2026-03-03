// Enhanced School Marquee with Futuristic/Luxurious Design
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

  // For seamless loop
  const displaySchools = [...schools, ...schools];

  return (
    <section className="py-24 bg-black relative overflow-hidden border-y border-white/5">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#ffd700]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#7dd3c0]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 mb-16 relative z-10">
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700] animate-pulse" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Institutional Network</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white text-center uppercase tracking-tighter">
            Trusted by the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] to-[#ffed4e]">Elite Educators</span> of Africa
          </h2>
        </div>
      </div>

      {/* Marquee Container with side masks for premium fade effect */}
      <div className="relative group overflow-hidden marquee-mask">
        <div className="flex animate-marquee-slow whitespace-nowrap gap-8 py-4">
          {displaySchools.map((school, index) => (
            <SchoolCard key={index} school={school} />
          ))}
        </div>
        
        {/* Seamless Mirror */}
        <div className="flex animate-marquee-slow-mirror absolute top-0 left-0 whitespace-nowrap gap-8 py-4">
          {displaySchools.map((school, index) => (
            <SchoolCard key={index} school={school} />
          ))}
        </div>
      </div>

      <style>{`
        .marquee-mask {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }

        @keyframes marquee-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-slow-mirror {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }

        .animate-marquee-slow {
          animation: marquee-slow 80s linear infinite;
        }
        .animate-marquee-slow-mirror {
          animation: marquee-slow 80s linear infinite;
          left: 100%;
        }

        .group:hover .animate-marquee-slow,
        .group:hover .animate-marquee-slow-mirror {
          animation-play-state: paused;
        }

        .school-card-glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        .logo-inner-shadow {
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </section>
  );
}

function SchoolCard({ school }: { school: { name: string, initials: string, color: string } }) {
  return (
    <div className="school-card-glass group/card relative flex items-center gap-5 p-5 rounded-2xl transition-all duration-500 hover:border-[#ffd700]/30 hover:bg-white/5 hover:translate-y-[-4px] min-w-[280px] md:min-w-[320px]">
      {/* Dynamic Futuristic Logo Placeholder */}
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${school.color} p-[1px] relative overflow-hidden flex-shrink-0 shadow-lg shadow-black/40`}>
        <div className="w-full h-full bg-black rounded-[11px] flex items-center justify-center relative z-10 overflow-hidden">
          {/* Abstract geometric background for logo */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,#fff_1px,transparent_1px)] bg-[size:4px_4px]" />
          </div>
          <span className={`text-transparent bg-clip-text bg-gradient-to-br ${school.color} font-black text-sm tracking-tighter`}>
            {school.initials}
          </span>
        </div>
        {/* Glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${school.color} opacity-0 group-hover/card:opacity-40 blur-md transition-opacity duration-500`} />
      </div>

      <div className="flex flex-col">
        <span className="text-white/80 group-hover/card:text-white font-bold text-sm md:text-base tracking-tight transition-colors">
          {school.name}
        </span>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]/40 group-hover/card:bg-[#ffd700] transition-colors" />
          <span className="text-[10px] font-black text-white/20 group-hover/card:text-[#7dd3c0] uppercase tracking-[0.2em] transition-colors">Verified Partner</span>
        </div>
      </div>

      {/* Decorative Corner */}
      <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <div className="absolute top-2 right-2 w-[1px] h-3 bg-[#ffd700]/50" />
        <div className="absolute top-2 right-2 w-3 h-[1px] bg-[#ffd700]/50" />
      </div>
    </div>
  );
}
