// Team Section - Luxury Morphism Design
function TeamSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const team = [
    {
      name: 'Uche Chiagozie Emmanuel',
      role: 'Founder / CEO',
      image: '/team/uche.png', // Placeholder path
      bio: 'Visionary leader driving the mission to transform African education through accessible technology.',
      socials: { linkedin: '#', twitter: '#' }
    },
    {
      name: 'Chinedu Anthony Joseph',
      role: 'Co-Founder',
      image: '/team/chinedu.png', // Placeholder path
      bio: 'Technical architect building robust, scalable solutions for schools across the continent.',
      socials: { linkedin: '#', twitter: '#' }
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="team" 
      ref={sectionRef}
      className="py-24 relative overflow-hidden bg-[#4a4f55]" // Fallback bg
    >
      {/* Subtle Yellow/Gold Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ffd700]/10 via-[#4a4f55] to-[#4a4f55] z-0" />
      
      {/* Decorative Gold Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffd700]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#ffd700]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
        {/* Section Header */}
        <div 
          className={`mb-20 text-center transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffd700]/10 border border-[#ffd700]/20 text-[#ffd700] text-xs font-bold uppercase tracking-widest mb-4">
            <Star className="w-3 h-3" />
            <span>Visionaries</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Building the <span className="text-[#ffd700]">Future of Education</span>
          </h2>
          <p className="max-w-2xl mx-auto text-white/60 text-lg leading-relaxed">
            We are on a mission to eliminate administrative burden from African schools, empowering teachers to focus on what matters most: educating the next generation.
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {team.map((member, index) => (
            <div
              key={index}
              className={`group relative p-1 rounded-3xl bg-gradient-to-br from-[#ffd700]/20 to-white/5 hover:from-[#ffd700]/40 hover:to-white/10 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${200 + index * 200}ms` }}
            >
              {/* Card Content */}
              <div className="relative h-full bg-[#3a3f45]/90 backdrop-blur-xl rounded-[22px] overflow-hidden p-8 border border-white/5 group-hover:border-[#ffd700]/20 transition-all">
                
                {/* Image Area with Gold Ring */}
                <div className="flex justify-center mb-8 relative">
                  <div className="absolute inset-0 bg-[#ffd700]/20 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative w-40 h-40 rounded-full p-1 bg-gradient-to-br from-[#ffd700] to-transparent">
                    <div className="w-full h-full rounded-full bg-[#2a2f35] overflow-hidden">
                      {/* Placeholder for user uploaded image - use object-cover and transparent bg assumption */}
                      <img 
                        src={member.image} 
                        alt={member.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ffd700&color=000`;
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Text Content */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">{member.name}</h3>
                  <p className="text-[#ffd700] font-medium tracking-wide uppercase text-sm mb-4">{member.role}</p>
                  <p className="text-white/50 text-sm leading-relaxed mb-6">
                    {member.bio}
                  </p>
                  
                  {/* Social Icons */}
                  <div className="flex justify-center gap-4">
                    <a href={member.socials.linkedin} className="p-2 rounded-full bg-white/5 hover:bg-[#ffd700] hover:text-black text-white/60 transition-all duration-300">
                      <Linkedin className="w-4 h-4" />
                    </a>
                    <a href={member.socials.twitter} className="p-2 rounded-full bg-white/5 hover:bg-[#ffd700] hover:text-black text-white/60 transition-all duration-300">
                      <Twitter className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
