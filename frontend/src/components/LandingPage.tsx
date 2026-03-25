import { motion } from 'framer-motion';
import {
  Zap,
  Timer,
  TrendingDown,
  TrendingUp,
  Lock,
  Package,
  ArrowRight,
  CheckCircle,
  XCircle,
  Layers,
  Radio,
  Clock,
  ExternalLink,
  ChevronDown,
  Code2,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  return (
    <div className="landing">
      {/* Animated grid background */}
      <div className="landing-grid-bg" />
      <div className="landing-gradient-overlay" />

      {/* Floating particles */}
      <div className="landing-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`particle particle-${i + 1}`} />
        ))}
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <Zap size={24} />
            <span>ReactiveAuction</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">Architecture</a>
            <a href="#comparison">Compare</a>
            <a href="https://github.com/Pratik-Shirodkar/somnia-reactive-auction-house" target="_blank" rel="noopener noreferrer">
              <Code2 size={16} /> GitHub
            </a>
            <button className="landing-cta-sm" onClick={onLaunchApp}>
              Launch App <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero">
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div className="hero-badge" variants={fadeUp} custom={0}>
            <Radio size={12} />
            <span>Built on Somnia Native Reactivity</span>
          </motion.div>
          <motion.h1 className="hero-title" variants={fadeUp} custom={1}>
            <span className="hero-title-line">On-Chain Auctions.</span>
            <span className="hero-title-gradient">Zero Infrastructure.</span>
          </motion.h1>
          <motion.p className="hero-subtitle" variants={fadeUp} custom={2}>
            The first fully autonomous auction house powered by Somnia's native reactivity.
            No keeper bots. No polling. No off-chain servers. Just blockchain.
          </motion.p>
          <motion.div className="hero-actions" variants={fadeUp} custom={3}>
            <button className="hero-btn-primary" onClick={onLaunchApp}>
              Launch App <ArrowRight size={18} />
            </button>
            <a
              className="hero-btn-secondary"
              href="https://github.com/Pratik-Shirodkar/somnia-reactive-auction-house"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Code2 size={18} /> View Source
            </a>
          </motion.div>
          <motion.div className="hero-stats" variants={fadeUp} custom={4}>
            <div className="hero-stat">
              <span className="hero-stat-value">4</span>
              <span className="hero-stat-label">Auction Types</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">105</span>
              <span className="hero-stat-label">Tests Passing</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">0</span>
              <span className="hero-stat-label">Off-Chain Deps</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">3</span>
              <span className="hero-stat-label">Reactivity Primitives</span>
            </div>
          </motion.div>
        </motion.div>
        <div className="hero-scroll-hint">
          <ChevronDown size={20} />
        </div>
      </section>

      {/* ===== PROBLEM / SOLUTION ===== */}
      <section className="landing-section" id="problem">
        <motion.div
          className="section-intro"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.span className="section-tag" variants={fadeUp} custom={0}>THE PROBLEM</motion.span>
          <motion.h2 variants={fadeUp} custom={1}>
            Traditional Auctions Need Babysitting
          </motion.h2>
          <motion.p className="section-desc" variants={fadeUp} custom={2}>
            Every on-chain auction today requires external infrastructure to function.
            When auctions expire, <strong>someone</strong> has to call <code>settle()</code>.
          </motion.p>
        </motion.div>
        <motion.div
          className="problem-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
        >
          {[
            { icon: <XCircle size={22} />, title: 'Chainlink Keepers', desc: '~$10/month per upkeep contract. Centralized dependency.', cost: '$120/yr' },
            { icon: <XCircle size={22} />, title: 'Gelato / Defender', desc: 'Off-chain relayer. Single point of failure.', cost: '$80/yr' },
            { icon: <XCircle size={22} />, title: 'Custom Bot Server', desc: 'Your own VPS running 24/7. DevOps overhead.', cost: '$240/yr' },
          ].map((item, i) => (
            <motion.div key={item.title} className="problem-card" variants={fadeUp} custom={i}>
              <div className="problem-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="problem-cost">{item.cost}</div>
            </motion.div>
          ))}
        </motion.div>
        <motion.div
          className="solution-callout"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Zap size={28} />
          <div>
            <h3>ReactiveAuction: $0/year</h3>
            <p>Somnia validators do the work. Auctions settle themselves. No infrastructure costs.</p>
          </div>
        </motion.div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="landing-section" id="features">
        <motion.div
          className="section-intro"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.span className="section-tag" variants={fadeUp} custom={0}>FEATURES</motion.span>
          <motion.h2 variants={fadeUp} custom={1}>Four Auction Types. One Protocol.</motion.h2>
        </motion.div>
        <motion.div
          className="features-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
        >
          {[
            {
              icon: <TrendingDown size={28} />,
              title: 'Dutch Auctions',
              desc: 'Price decreases per-block. First buyer wins. Instant settlement via Schedule trigger.',
              color: '#f43f5e',
            },
            {
              icon: <TrendingUp size={28} />,
              title: 'English Auctions',
              desc: 'Classic ascending bids with anti-snipe protection. Auto-extends on late bids.',
              color: '#10b981',
            },
            {
              icon: <Lock size={28} />,
              title: 'Sealed-Bid Auctions',
              desc: 'Cryptographic commit-reveal. Bids hidden until reveal phase. Fairest price discovery.',
              color: '#8b5cf6',
            },
            {
              icon: <Package size={28} />,
              title: 'Bundle Auctions',
              desc: 'Batch multiple NFTs/tokens into a single auction. All-or-nothing settlement.',
              color: '#f59e0b',
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card"
              variants={fadeUp}
              custom={i}
              style={{ '--feature-color': f.color } as React.CSSProperties}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="landing-section" id="how-it-works">
        <motion.div
          className="section-intro"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.span className="section-tag" variants={fadeUp} custom={0}>ARCHITECTURE</motion.span>
          <motion.h2 variants={fadeUp} custom={1}>Three Reactivity Primitives. Zero Bots.</motion.h2>
          <motion.p className="section-desc" variants={fadeUp} custom={2}>
            Somnia's native reactivity replaces three separate off-chain systems with on-chain automation.
          </motion.p>
        </motion.div>
        <motion.div
          className="arch-flow"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
        >
          {[
            {
              step: '01',
              icon: <Layers size={28} />,
              title: 'Event Subscription',
              desc: 'AuctionHandler subscribes to AuctionCreated events. When a new auction is deployed, the handler reacts automatically.',
              primitive: 'SomniaEventHandler',
            },
            {
              step: '02',
              icon: <Clock size={28} />,
              title: 'Schedule Trigger',
              desc: 'Handler creates a Schedule subscription at the exact endTime. Somnia validators fire the callback at the precise millisecond.',
              primitive: 'Schedule System Event',
            },
            {
              step: '03',
              icon: <Timer size={28} />,
              title: 'Auto-Settlement',
              desc: 'When the schedule fires, onEvent() calls settleAuction(). The winner receives their item. No human intervention.',
              primitive: 'Atomic Execution',
            },
          ].map((item, i) => (
            <motion.div key={item.step} className="arch-step" variants={fadeUp} custom={i}>
              <div className="arch-step-number">{item.step}</div>
              <div className="arch-step-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="arch-primitive">{item.primitive}</div>
              {i < 2 && <div className="arch-connector" />}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="landing-section" id="comparison">
        <motion.div
          className="section-intro"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.span className="section-tag" variants={fadeUp} custom={0}>COMPARISON</motion.span>
          <motion.h2 variants={fadeUp} custom={1}>How We Stack Up</motion.h2>
        </motion.div>
        <motion.div
          className="comparison-table-wrap"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Traditional</th>
                <th className="highlight-col">ReactiveAuction</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Auto-Settlement', false, true],
                ['Zero Infrastructure Cost', false, true],
                ['Anti-Snipe Protection', false, true],
                ['Sealed-Bid Privacy', false, true],
                ['Multi-Currency (ERC20)', 'Partial', true],
                ['Real-Time UI (no polling)', false, true],
                ['On-Chain Analytics', false, true],
                ['Bundle Auctions', false, true],
              ].map(([feature, trad, reactive], i) => (
                <tr key={i}>
                  <td>{feature}</td>
                  <td className="compare-cell">
                    {trad === true ? (
                      <CheckCircle size={18} color="#10b981" />
                    ) : trad === false ? (
                      <XCircle size={18} color="#ef4444" />
                    ) : (
                      <span className="compare-partial">{trad}</span>
                    )}
                  </td>
                  <td className="compare-cell highlight-col">
                    {reactive === true ? (
                      <CheckCircle size={18} color="#10b981" />
                    ) : (
                      <XCircle size={18} color="#ef4444" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* ===== TECH STACK ===== */}
      <section className="landing-section">
        <motion.div
          className="section-intro"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.span className="section-tag" variants={fadeUp} custom={0}>TECH STACK</motion.span>
          <motion.h2 variants={fadeUp} custom={1}>Built With Best-in-Class Tools</motion.h2>
        </motion.div>
        <motion.div
          className="tech-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
        >
          {[
            { name: 'Solidity 0.8.24', desc: 'Smart contracts with viaIR optimizer' },
            { name: 'Hardhat', desc: 'Compile, test, deploy pipeline' },
            { name: 'React 19', desc: 'Modern UI with hooks & TypeScript' },
            { name: 'Vite', desc: 'Lightning-fast dev server & bundler' },
            { name: 'Viem', desc: 'Type-safe Ethereum interactions' },
            { name: 'Framer Motion', desc: 'Smooth animations & transitions' },
            { name: 'Somnia Reactivity', desc: 'Native on-chain event handling' },
            { name: 'Mocha + fast-check', desc: '105 tests with property testing' },
          ].map((tech, i) => (
            <motion.div key={tech.name} className="tech-card" variants={fadeUp} custom={i}>
              <h4>{tech.name}</h4>
              <p>{tech.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-cta-section">
        <motion.div
          className="cta-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Ready to Experience Autonomous Auctions?</h2>
          <p>Connect your wallet and create your first self-settling auction in under 60 seconds.</p>
          <div className="cta-buttons">
            <button className="hero-btn-primary" onClick={onLaunchApp}>
              Launch App <ArrowRight size={18} />
            </button>
            <a
              className="hero-btn-secondary"
              href="https://shannon-explorer.somnia.network/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={18} /> View on Explorer
            </a>
          </div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Zap size={20} />
            <span>ReactiveAuction</span>
          </div>
          <p>Built for the Somnia Reactivity Hackathon 2026</p>
          <div className="landing-footer-links">
            <a href="https://github.com/Pratik-Shirodkar/somnia-reactive-auction-house" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://shannon-explorer.somnia.network/" target="_blank" rel="noopener noreferrer">Explorer</a>
            <a href="https://testnet.somnia.network/" target="_blank" rel="noopener noreferrer">Faucet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
