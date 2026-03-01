import { useEffect, useRef, useState } from 'react';
import { Star, Linkedin, Twitter, Cpu, Megaphone, Sparkles, ExternalLink } from 'lucide-react';

// Team Section - Smart Futuristic Side-by-Side Design
export function TeamSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const team = [
    {
      name: 'Uche Chiagozie Emmanuel',
      role: 'Founder / CEO',
      specialty: 'Visionary & Technical Lead',
      icon: Cpu,
      image: '/team/uche.png',
      bio: 'The <span class="text-[#ffd700] font-semibold">architect of KUMO-AI intelligence</span>. Combining deep technical expertise with a vision to revolutionize how African schools operate through seamless AI integration.',
      socials: { linkedin: '#', twitter: '#' }
    },
    {
      name: 'Chinedu Anthony Joseph',
      role: 'Co-Founder',
      specialty: 'Marketing & Growth Operations',
      icon: Megaphone,
      image: '/team/chinedu.png',
      bio: 'Driving the <span class="text-[#ffd700] font-semibold">expansion across the continent</span>. Expert in growth strategy and school partnerships, ensuring KUMO-AI reaches every classroom that needs it.',
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
      { threshold: 0.1 }
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
      className="py-20 relative overflow-hidden bg-[#4a4f55]"
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.08),transparent_50%)] z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(125,211,192,0.05),transparent_50%)] z-0" />

      <div className="max-w-6xl mx-auto px-6 lg:px-12 relative z-10">
        {/* Compact Header */}
        <div 
          className={`mb-12 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-[1px] w-8 bg-[#ffd700]/50" />
            <span className="text-[#ffd700] text-[10px] font-black uppercase tracking-[0.3em]">The Vanguard</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Meet the <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Founding Duo</span>
          </h2>
        </div>

        {/* Compact Horizontal Team Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {team.map((member, index) => {
            const MemberIcon = member.icon;
            return (
              <div
                key={index}
                className={`group relative transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                }`}
                style={{ transitionDelay: `${100 + index * 200}ms` }}
              >
                {/* Luxury Morphism Container */}
                <div className="relative flex flex-col sm:flex-row bg-[#3a3f45]/40 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/5 group-hover:border-[#ffd700]/30 transition-all duration-500 shadow-2xl">
                  
                  {/* Left Side: Portrait Image (Small & Sharp) */}
                  <div className="w-full sm:w-2/5 relative aspect-[4/5] sm:aspect-auto overflow-hidden bg-black/20">
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="w-full h-full object-cover object-center grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=1a1f25&color=ffd700&bold=true`;
                      }}
                    />
                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#3a3f45] via-transparent to-transparent sm:hidden" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#3a3f45]/40 hidden sm:block" />
                  </div>

                  {/* Right Side: Content (Smart & Technical) */}
                  <div className="w-full sm:w-3/5 p-5 flex flex-col justify-between">
                    <div>
                      {/* Name & Icon Row */}
                      <div className="flex items-center gap-2 mb-1">
                        <MemberIcon className="w-3.5 h-3.5 text-[#ffd700]" strokeWidth={2.5} />
                        <h3 className="text-lg font-black text-white tracking-tight uppercase leading-none">
                          {member.name.split(' ')[0]} <span className="text-[#ffd700]">{member.name.split(' ').slice(1).join(' ')}</span>
                        </h3>
                      </div>
                      
                      {/* Role Pill */}
                      <div className="inline-block px-2 py-0.5 rounded bg-white/5 border border-white/10 mb-3">
                        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{member.role}</p>
                      </div>

                      {/* Specialty Highlight */}
                      <div className="flex items-center gap-1.5 mb-4">
                        <Sparkles className="w-3 h-3 text-[#7dd3c0]" />
                        <span className="text-[11px] font-medium text-[#7dd3c0]/90 italic">{member.specialty}</span>
                      </div>

                      {/* Bio with Highlight */}
                      <p 
                        className="text-white/50 text-xs leading-relaxed line-clamp-4"
                        dangerouslySetInnerHTML={{ __html: member.bio }}
                      />
                    </div>

                    {/* Footer: Socials & Link */}
                    <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                      <div className="flex gap-3">
                        <a href={member.socials.linkedin} className="text-white/30 hover:text-[#ffd700] transition-colors">
                          <Linkedin className="w-4 h-4" strokeWidth={1.5} />
                        </a>
                        <a href={member.socials.twitter} className="text-white/30 hover:text-[#ffd700] transition-colors">
                          <Twitter className="w-4 h-4" strokeWidth={1.5} />
                        </a>
                      </div>
                      <button className="flex items-center gap-1 text-[9px] font-black text-[#ffd700]/60 uppercase tracking-tighter hover:text-[#ffd700] transition-colors">
                        Protocol Profile <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Corner Accent */}
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity">
                    <div className="absolute top-[-25px] right-[-25px] w-12 h-12 bg-[#ffd700] rotate-45" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vision Narrative (Storytelling) */}
        <div 
          className={`mt-16 p-8 rounded-2xl bg-gradient-to-r from-black/20 to-transparent border-l-2 border-[#ffd700]/30 transition-all duration-1000 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <h4 className="text-[#ffd700] font-black text-[10px] uppercase tracking-[0.4em] mb-4">Origin Protocol</h4>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                Born from the realization that <span className="text-white font-bold">teachers spend 40% of their time on logistics</span> rather than learning. KUMO-AI was founded to reclaim those hours.
              </p>
              <p className="text-white/40 text-xs italic leading-relaxed">
                "Our technology doesn't replace the educator; it removes the friction that blocks their true potential. We are building the nervous system for the next generation of African education."
              </p>
            </div>
            <div className="flex items-center justify-center border-l border-white/5 pl-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#ffd700]/10 flex items-center justify-center mx-auto mb-3 border border-[#ffd700]/20 animate-pulse">
                  <Star className="w-6 h-6 text-[#ffd700]" />
                </div>
                <p className="text-white font-black text-2xl leading-none">500+</p>
                <p className="text-white/30 text-[9px] uppercase font-bold tracking-widest mt-1">Impact Radius</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
