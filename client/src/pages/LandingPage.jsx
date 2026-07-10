import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const LandingPage = () => {
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  const isLoggedIn = isAuthenticated && !isTokenExpired(token);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Scroll-based navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observer for fade-in animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.lp-animate').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const smoothScroll = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const features = [
    {
      icon: '🖥️',
      title: 'Real-Time Collaboration',
      desc: 'Multiple developers coding simultaneously in the same workspace. Every keystroke syncs instantly.',
      bgGradient: 'linear-gradient(135deg, #1e3a8a 0%, #111827 100%)',
      glowColor: 'rgba(59,130,246,0.3)',
      borderColor: '#3b82f6'
    },
    {
      icon: '🤖',
      title: 'AI Copilot Assistant',
      desc: 'Built-in AI that understands your code context. Ask questions, generate code, debug issues.',
      bgGradient: 'linear-gradient(135deg, #4c1d95 0%, #111827 100%)',
      glowColor: 'rgba(139,92,246,0.3)',
      borderColor: '#8b5cf6'
    },
    {
      icon: '⚡',
      title: 'In-Browser Execution',
      desc: 'Run your code directly in the browser. Support for JavaScript, Python, C++, and more.',
      bgGradient: 'linear-gradient(135deg, #78350f 0%, #111827 100%)',
      glowColor: 'rgba(245,158,11,0.3)',
      borderColor: '#f59e0b'
    },
    {
      icon: '🔍',
      title: 'Smart Code Audit',
      desc: 'AI-powered code analysis that detects bugs, security issues, and suggests improvements.',
      bgGradient: 'linear-gradient(135deg, #064e3b 0%, #111827 100%)',
      glowColor: 'rgba(16,185,129,0.3)',
      borderColor: '#10b981'
    },
    {
      icon: '💬',
      title: 'Team Chat',
      desc: 'In-workspace messaging for seamless communication. No need to switch between tools.',
      bgGradient: 'linear-gradient(135deg, #831843 0%, #111827 100%)',
      glowColor: 'rgba(236,72,153,0.3)',
      borderColor: '#ec4899'
    },
    {
      icon: '🏟️',
      title: 'Coding Arena',
      desc: 'Practice DSA problems and algorithmic challenges in a secure sandbox environment.',
      bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #111827 100%)',
      glowColor: 'rgba(249,115,22,0.3)',
      borderColor: '#f97316'
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Create Your Account',
      desc: 'Sign up with email verification. Your identity is secured with OTP-based authentication.',
    },
    {
      num: '02',
      title: 'Initialize Workspace',
      desc: 'Create your coding environment in seconds. Pre-configured with everything you need.',
    },
    {
      num: '03',
      title: 'Collaborate & Build',
      desc: 'Invite your team, code together in real-time, use AI tools, and ship faster than ever.',
    },
  ];

  const faqs = [
    {
      q: 'Is DevSync AI free to use?',
      a: 'Yes! DevSync AI is completely free for developers. Create unlimited workspaces, collaborate with your team, and use all AI-powered features at no cost.',
    },
    {
      q: 'Which programming languages are supported?',
      a: 'DevSync AI supports JavaScript, Python, C++, Java, and many more languages. Our AI-powered execution engine can run code in virtually any popular language.',
    },
    {
      q: 'How does real-time collaboration work?',
      a: 'When you create a workspace, you can invite team members via email. Everyone sees changes in real-time — every keystroke, file creation, and code execution is synced instantly across all participants.',
    },
    {
      q: 'Is my code secure?',
      a: 'Absolutely. All data is encrypted in transit and at rest. Your code stays in your workspace and is never used to train AI models. We use industry-standard security practices.',
    },
    {
      q: 'Can I use DevSync AI for interviews?',
      a: 'Yes! DevSync AI has built-in interview room functionality. Create a workspace, invite the candidate, set a timer, and conduct technical interviews with real-time code collaboration.',
    },
  ];

  const stats = [
    { value: '500+', label: 'Active Developers' },
    { value: '1,200+', label: 'Workspaces Created' },
    { value: '< 50ms', label: 'Sync Latency' },
    { value: '24/7', label: 'AI Availability' },
  ];

  return (
    <div style={{ background: isDarkMode ? '#000000' : '#ffffff', color: isDarkMode ? '#ffffff' : '#000000', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", overflowX: 'hidden', transition: 'background 0.3s ease, color 0.3s ease' }}>

      {/* ==================== NAVBAR ==================== */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(0, 0, 0, 0.95)' : '#000000',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(51, 65, 85, 0.5)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '72px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => smoothScroll('hero')}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', fontWeight: '800', color: '#ffffff',
            }}>D</div>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.5px' }}>DevSync AI</span>
          </div>

          {/* Desktop Links */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }} className="lp-desktop-nav">
            {['Features', 'How It Works', 'FAQ'].map((item) => (
              <button key={item} onClick={() => smoothScroll(item.toLowerCase().replace(/ /g, '-'))}
                style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'color 0.2s', padding: '4px 0' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#d1d5db'}
              >{item}</button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} className="lp-desktop-nav">
            {isLoggedIn ? (
              <Link to="/dashboard" style={{
                padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff',
                textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)'; }}
              >Go to Dashboard →</Link>
            ) : (
              <>
                <Link to="/login" style={{
                  padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '500',
                  color: '#ffffff', textDecoration: 'none', border: '1px solid #4b5563',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.target.style.color = '#000000'; e.target.style.backgroundColor = '#ffffff'; }}
                onMouseLeave={(e) => { e.target.style.color = '#ffffff'; e.target.style.backgroundColor = 'transparent'; }}
                >Log In</Link>
                <Link to="/signup" style={{
                  padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff',
                  textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                }}
                onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)'; }}
                onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)'; }}
                >Get Started Free</Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button className="lp-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'none', background: 'none', border: 'none', color: '#ffffff', fontSize: '24px', cursor: 'pointer' }}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.98)', backdropFilter: 'blur(12px)',
            borderTop: '1px solid #333333', padding: '16px 24px',
          }} className="lp-mobile-menu">
            {['Features', 'How It Works', 'FAQ'].map((item) => (
              <button key={item} onClick={() => smoothScroll(item.toLowerCase().replace(/ /g, '-'))}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#ffffff', fontSize: '15px', padding: '12px 0', cursor: 'pointer', borderBottom: '1px solid #333333' }}
              >{item}</button>
            ))}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {isLoggedIn ? (
                <Link to="/dashboard" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff', textDecoration: 'none', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>Dashboard →</Link>
              ) : (
                <>
                  <Link to="/login" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #4b5563', color: '#ffffff', textDecoration: 'none', textAlign: 'center', fontSize: '14px' }}>Log In</Link>
                  <Link to="/signup" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff', textDecoration: 'none', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>Sign Up</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ==================== HERO SECTION ==================== */}
      <section id="hero" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', overflow: 'hidden' }}>
        {/* Background Glows */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
        {/* Grid pattern overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(51,65,85,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div className="lp-animate" style={{ marginBottom: '24px' }}>
            <span style={{
              display: 'inline-block', padding: '6px 16px', borderRadius: '100px',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa', fontSize: '13px', fontWeight: '500',
            }}>
              ✨ AI-Powered Collaborative IDE
            </span>
          </div>

          <h1 className="lp-animate" style={{
            fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: '800', lineHeight: 1.1,
            letterSpacing: '-1.5px', margin: '0 0 24px',
            background: isDarkMode ? 'linear-gradient(135deg, #ffffff 0%, #9ca3af 100%)' : 'linear-gradient(135deg, #000000 0%, #4b5563 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Code Together.<br />Build Faster.<br />Ship Smarter.
          </h1>

          <p className="lp-animate" style={{
            fontSize: 'clamp(16px, 2vw, 19px)', color: isDarkMode ? '#d1d5db' : '#000000', lineHeight: 1.7,
            maxWidth: '600px', margin: '0 auto 40px',
          }}>
            DevSync AI is a real-time collaborative coding platform with an AI copilot,
            in-browser code execution, smart audits, and team tools — everything you need to build together.
          </p>

          <div className="lp-animate" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={isLoggedIn ? "/dashboard" : "/signup"} style={{
              padding: '14px 36px', borderRadius: '12px', fontSize: '16px', fontWeight: '700',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff',
              textDecoration: 'none', transition: 'all 0.3s',
              boxShadow: '0 4px 25px rgba(59,130,246,0.35)',
            }}
            onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(59,130,246,0.5)'; }}
            onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 25px rgba(59,130,246,0.35)'; }}
            >
              {isLoggedIn ? 'Go to Dashboard →' : 'Start Building Free →'}
            </Link>
            <button onClick={() => smoothScroll('features')} style={{
              padding: '14px 28px', borderRadius: '12px', fontSize: '16px', fontWeight: '600',
              background: 'transparent', color: isDarkMode ? '#ffffff' : '#000000', border: isDarkMode ? '1px solid #4b5563' : '1px solid #e2e8f0',
              cursor: 'pointer', transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => { e.target.style.color = isDarkMode ? '#000000' : '#ffffff'; e.target.style.backgroundColor = isDarkMode ? '#ffffff' : '#000000'; e.target.style.borderColor = isDarkMode ? '#ffffff' : '#000000'; }}
            onMouseLeave={(e) => { e.target.style.color = isDarkMode ? '#ffffff' : '#000000'; e.target.style.backgroundColor = 'transparent'; e.target.style.borderColor = isDarkMode ? '#4b5563' : '#e2e8f0'; }}
            >Learn More ↓</button>
          </div>

          {/* Code mockup */}
          <div className="lp-animate" style={{
            marginTop: '60px', background: '#0d1117', borderRadius: '16px',
            border: '1px solid #30363d', overflow: 'hidden', textAlign: 'left',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}>
            {/* Title bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid #30363d', background: '#161b22' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ marginLeft: '12px', color: '#8b949e', fontSize: '13px', fontFamily: 'monospace', fontWeight: '500' }}>workspace.js — DevSync AI</span>
            </div>
            {/* Code content */}
            <div style={{ padding: '24px', fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: '15px', lineHeight: 1.8, color: '#e6edf3' }}>
              <div><span style={{ color: '#ff7b72' }}>const</span> <span style={{ color: '#79c0ff' }}>workspace</span> = <span style={{ color: '#ff7b72' }}>await</span> <span style={{ color: '#d2a8ff' }}>DevSync</span>.<span style={{ color: '#d2a8ff' }}>create</span><span style={{ color: '#e6edf3' }}>{'{'}</span></div>
              <div style={{ paddingLeft: '24px' }}><span style={{ color: '#79c0ff' }}>name</span>: <span style={{ color: '#a5d6ff' }}>'My Awesome Project'</span>,</div>
              <div style={{ paddingLeft: '24px' }}><span style={{ color: '#79c0ff' }}>team</span>: [<span style={{ color: '#a5d6ff' }}>'alice@dev.io'</span>, <span style={{ color: '#a5d6ff' }}>'bob@dev.io'</span>],</div>
              <div style={{ paddingLeft: '24px' }}><span style={{ color: '#79c0ff' }}>ai</span>: <span style={{ color: '#79c0ff' }}>true</span>,</div>
              <div><span style={{ color: '#e6edf3' }}>{'}'}</span>);</div>
              <div style={{ marginTop: '12px' }}><span style={{ color: '#8b949e', fontStyle: 'italic' }}>// 🚀 Workspace deployed. 2 collaborators connected.</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== STATS BAR ==================== */}
      <section style={{ borderTop: isDarkMode ? '1px solid #1f2937' : '1px solid #ffffff', borderBottom: isDarkMode ? '1px solid #1f2937' : '1px solid #ffffff', background: isDarkMode ? '#111827' : '#f8fafc', transition: 'all 0.3s ease' }}>
        <div className="lp-animate" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', textAlign: 'center' }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '800', background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
              <div style={{ color: isDarkMode ? '#d1d5db' : '#000000', fontSize: '14px', marginTop: '4px', fontWeight: '500' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== FEATURES SECTION ==================== */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px' }}>
        <div className="lp-animate" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '100px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>Features</span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', margin: '0 0 16px', color: isDarkMode ? '#ffffff' : '#000000' }}>Everything You Need to Build</h2>
          <p style={{ color: isDarkMode ? '#9ca3af' : '#4b5563', fontSize: '17px', maxWidth: '550px', margin: '0 auto' }}>Powerful tools designed for modern development teams. All in one place.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {features.map((f, i) => (
            <div key={i} className="lp-animate" style={{
              background: f.bgGradient, border: '1px solid #374151', borderRadius: '20px',
              padding: '32px', transition: 'all 0.3s ease', cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.borderColor; e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 15px 40px ${f.glowColor}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '36px', marginBottom: '16px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>{f.icon}</div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>{f.title}</h3>
              <p style={{ color: '#e5e7eb', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section id="how-it-works" style={{ background: '#f8fafc', borderTop: isDarkMode ? '1px solid #1f2937' : '1px solid #ffffff', borderBottom: isDarkMode ? '1px solid #1f2937' : '1px solid #ffffff', transition: 'all 0.3s ease' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px' }}>
          <div className="lp-animate" style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '100px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>How It Works</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', margin: '0 0 16px', color: isDarkMode ? '#ffffff' : '#000000' }}>Up and Running in Minutes</h2>
            <p style={{ color: isDarkMode ? '#9ca3af' : '#4b5563', fontSize: '17px', maxWidth: '550px', margin: '0 auto' }}>Three simple steps to start coding collaboratively.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
            {steps.map((s, i) => (
              <div key={i} className="lp-animate" style={{ 
                textAlign: 'center', padding: '40px 24px', 
                background: '#374151', border: '1px solid #4b5563', borderRadius: '16px',
                transition: 'transform 0.3s', cursor: 'default'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#4b5563'; }}
              >
                <div style={{
                  width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                  border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: '800', color: '#60a5fa', fontFamily: 'monospace',
                }}>{s.num}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>{s.title}</h3>
                <p style={{ color: '#d1d5db', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ SECTION ==================== */}
      <section id="faq" style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 24px' }}>
        <div className="lp-animate" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '100px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#34d399', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>FAQ</span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', margin: '0 0 16px', color: isDarkMode ? '#ffffff' : '#000000' }}>Frequently Asked Questions</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, i) => (
            <div key={i} className="lp-animate" style={{
              background: '#374151', border: '1px solid #4b5563', borderRadius: '12px',
              overflow: 'hidden', transition: 'border-color 0.3s',
              borderColor: openFaq === i ? '#3b82f6' : '#4b5563',
            }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                width: '100%', padding: '20px 24px', background: 'none', border: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ color: '#ffffff', fontSize: '15px', fontWeight: '600' }}>{faq.q}</span>
                <span style={{
                  color: '#ffffff', fontSize: '20px', fontWeight: '300',
                  transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}>+</span>
              </button>
              <div style={{
                maxHeight: openFaq === i ? '200px' : '0',
                overflow: 'hidden', transition: 'max-height 0.3s ease',
              }}>
                <p style={{ padding: '0 24px 20px', color: '#d1d5db', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== CTA SECTION ==================== */}
      <section style={{
        margin: '0 24px 80px', borderRadius: '24px', padding: '80px 40px', textAlign: 'center',
        background: '#18181b', border: '1px solid #3f3f46', position: 'relative', overflow: 'hidden',
        maxWidth: '1152px', marginLeft: 'auto', marginRight: 'auto',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
      }}>
        {/* Glow Effects inside the dark card */}
        <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
        
        <div className="lp-animate" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '800', color: '#ffffff', marginBottom: '16px', letterSpacing: '-1px' }}>Ready to Code Together?</h2>
          <p style={{ color: '#a1a1aa', fontSize: '17px', maxWidth: '500px', margin: '0 auto 32px' }}>Join thousands of developers building the future, together. It's free to get started.</p>
          <Link to={isLoggedIn ? "/dashboard" : "/signup"} style={{
            display: 'inline-block', padding: '16px 40px', borderRadius: '12px', fontSize: '16px', fontWeight: '700',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#ffffff',
            textDecoration: 'none', boxShadow: '0 4px 25px rgba(59,130,246,0.4)',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(59,130,246,0.6)'; }}
          onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 25px rgba(59,130,246,0.4)'; }}
          >{isLoggedIn ? 'Go to Dashboard →' : 'Get Started Free →'}</Link>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer style={{ borderTop: '1px solid #333333', background: '#000000' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', marginBottom: '48px' }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>D</div>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>DevSync AI</span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.6, maxWidth: '260px' }}>Real-time collaborative coding platform powered by AI. Build together, ship faster.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform</h4>
              {['Features', 'How It Works', 'FAQ'].map((item) => (
                <button key={item} onClick={() => smoothScroll(item.toLowerCase().replace(/ /g, '-'))}
                  style={{ display: 'block', background: 'none', border: 'none', color: '#9ca3af', fontSize: '14px', padding: '6px 0', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                  onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
                >{item}</button>
              ))}
            </div>

            {/* Account */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Account</h4>
              <Link to="/login" style={{ display: 'block', color: '#9ca3af', fontSize: '14px', padding: '6px 0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >Log In</Link>
              <Link to="/signup" style={{ display: 'block', color: '#9ca3af', fontSize: '14px', padding: '6px 0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >Sign Up</Link>
            </div>

            {/* Legal */}
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Legal</h4>
              <a href="#" style={{ display: 'block', color: '#9ca3af', fontSize: '14px', padding: '6px 0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >Terms & Conditions</a>
              <a href="#" style={{ display: 'block', color: '#9ca3af', fontSize: '14px', padding: '6px 0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >Privacy Policy</a>
              <a href="#" style={{ display: 'block', color: '#9ca3af', fontSize: '14px', padding: '6px 0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
              >Contact Us</a>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid #333333', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>© {new Date().getFullYear()} DevSync AI. All rights reserved.</p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Built with ❤️ for developers worldwide.</p>
          </div>
        </div>
      </footer>

      {/* ==================== STYLES ==================== */}
      <style>{`
        /* Fade-in animation on scroll */
        .lp-animate {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .lp-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Responsive: Mobile nav */
        @media (max-width: 768px) {
          .lp-desktop-nav { display: none !important; }
          .lp-mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .lp-mobile-menu { display: none !important; }
        }

        /* Stats responsive */
        @media (max-width: 640px) {
          section > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
