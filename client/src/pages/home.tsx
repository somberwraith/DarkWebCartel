import { useEffect, useState } from "react";
import { Skull, Shield, Users, Zap, ExternalLink } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faTelegram } from "@fortawesome/free-brands-svg-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const fullText = "ACCESS GRANTED > WELCOME TO THE CARTEL";

  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [typedText]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "ACTIVE NODES", value: "1,247", icon: Users },
    { label: "UPTIME", value: "99.9%", icon: Zap },
    { label: "SECURITY LVL", value: "MAX", icon: Shield },
  ];

  const rules = [
    { id: 1, text: "Maintain operational security at all times" },
    { id: 2, text: "No external surveillance - encrypted channels only" },
    { id: 3, text: "Respect the collective - we operate as one" },
    { id: 4, text: "Share knowledge - elevate the network" },
    { id: 5, text: "What happens in CARTEL stays in CARTEL" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground scanline crt-screen">
      {/* Boot sequence header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" data-testid="status-indicator" />
              <Badge variant="outline" className="font-mono text-xs tracking-wider border-primary/50" data-testid="badge-status">
                SYSTEM ONLINE
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono tracking-wide hidden sm:inline" data-testid="text-url">
              joincartel.org
            </span>
          </div>
        </div>
      </header>

      {/* Hero terminal section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-10">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute text-primary font-mono text-xs"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `fadeIn ${Math.random() * 3 + 2}s ease-in-out infinite`,
                }}
              >
                {Math.random().toString(36).substring(2, 15)}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 max-w-5xl w-full">
          {/* ASCII Art Logo */}
          <div className="text-center mb-12">
            <pre className="text-primary font-mono text-xs sm:text-sm md:text-base lg:text-lg leading-tight text-shadow-glow select-none" data-testid="text-logo">
{`
 ██████╗ █████╗ ██████╗ ████████╗███████╗██╗     
██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║     
██║     ███████║██████╔╝   ██║   █████╗  ██║     
██║     ██╔══██║██╔══██╗   ██║   ██╔══╝  ██║     
╚██████╗██║  ██║██║  ██║   ██║   ███████╗███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝
`}
            </pre>
          </div>

          {/* Typing animation */}
          <div className="mb-12">
            <div className="bg-card border border-card-border p-6 rounded font-mono">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-chart-5" />
                  <div className="w-3 h-3 rounded-full bg-primary" />
                </div>
                <span className="text-xs text-muted-foreground tracking-wider">TERMINAL v2.7.3</span>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm">
                  <span className="text-primary">root@cartel</span>:~$ access_network
                </div>
                <div className="text-sm">
                  <span className="text-foreground" data-testid="text-typing">{typedText}</span>
                  {showCursor && <span className="text-primary">▊</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <div className="text-center space-y-6 mb-16">
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto tracking-wide" data-testid="text-description">
              A DECENTRALIZED COLLECTIVE OPERATING BEYOND THE DIGITAL FRONTIER. 
              JOIN OUR ENCRYPTED NETWORK AND BECOME PART OF THE UNDERGROUND.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gap-2 text-base font-mono tracking-wider glow-pulse"
                data-testid="button-join-discord"
                onClick={() => window.open('https://discord.gg/cartel', '_blank')}
              >
                <FontAwesomeIcon icon={faDiscord} className="w-5 h-5" />
                DISCORD SERVER
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2 text-base font-mono tracking-wider border-primary/50"
                data-testid="button-join-telegram"
                onClick={() => window.open('https://t.me/narcowraith', '_blank')}
              >
                <FontAwesomeIcon icon={faTelegram} className="w-5 h-5" />
                TELEGRAM
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-6 border-primary/30 hover-elevate" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="flex items-center gap-3 mb-3">
                  <stat.icon className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground font-mono tracking-wider">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-primary font-mono text-shadow-glow" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Server Info */}
      <section className="py-20 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-primary/30 overflow-hidden">
            <div className="bg-card-border/50 px-6 py-3 border-b border-card-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm tracking-wider text-foreground">SERVER_INFO.LOG</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground font-mono">LIVE</span>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-3 font-mono tracking-wide" data-testid="heading-about">
                  &gt; ABOUT_THE_NETWORK
                </h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-about">
                  The CARTEL is a collective of digital operators, hackers, and technologists 
                  working together in the shadows of the internet. We share knowledge, tools, 
                  and resources to push the boundaries of what's possible. Our Discord server 
                  is the hub for all operations - a place where anonymity meets collaboration.
                </p>
              </div>
              
              <div className="border-l-2 border-primary pl-4">
                <p className="text-sm text-foreground font-mono">
                  "In the digital underground, we don't ask for permission. We create our own rules."
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Rules Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-destructive/30">
            <div className="bg-destructive/10 px-6 py-3 border-b border-destructive/30 flex items-center gap-3">
              <Skull className="w-4 h-4 text-destructive" />
              <span className="font-mono text-sm tracking-wider text-foreground">NETWORK_PROTOCOLS.SYS</span>
            </div>
            <div className="p-8">
              <h2 className="text-2xl font-bold text-destructive mb-6 font-mono tracking-wide" data-testid="heading-rules">
                &gt; OPERATIONAL_RULES
              </h2>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div 
                    key={rule.id} 
                    className="flex gap-4 items-start hover-elevate p-3 rounded transition-all"
                    data-testid={`rule-${rule.id}`}
                  >
                    <Badge variant="outline" className="font-mono text-xs border-destructive/50 text-destructive shrink-0">
                      {String(rule.id).padStart(2, '0')}
                    </Badge>
                    <p className="text-muted-foreground font-mono text-sm pt-0.5">{rule.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Discord Widget Section */}
      <section className="py-20 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-primary/50 bg-gradient-to-br from-card to-card/50">
            <div className="p-8 md:p-12 text-center space-y-6">
              <div className="inline-flex items-center gap-3 bg-primary/10 border border-primary/30 rounded px-4 py-2">
                <FontAwesomeIcon icon={faDiscord} className="w-6 h-6 text-primary" />
                <span className="font-mono text-sm tracking-wider text-primary">ENCRYPTED CHANNEL</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-primary font-mono tracking-wide" data-testid="heading-join">
                &gt; JOIN_THE_NETWORK
              </h2>
              
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed" data-testid="text-join-description">
                Ready to enter the underground? Our Discord server is where the real action happens. 
                Connect with fellow operators, access exclusive resources, and participate in collaborative operations.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  size="lg" 
                  className="gap-2 font-mono tracking-wider w-full sm:w-auto"
                  data-testid="button-join-now"
                  onClick={() => window.open('https://discord.gg/cartel', '_blank')}
                >
                  <FontAwesomeIcon icon={faDiscord} className="w-5 h-5" />
                  JOIN DISCORD
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 font-mono tracking-wider border-primary/50 w-full sm:w-auto"
                  data-testid="button-telegram"
                  onClick={() => window.open('https://t.me/narcowraith', '_blank')}
                >
                  <FontAwesomeIcon icon={faTelegram} className="w-5 h-5" />
                  TELEGRAM
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
                {[
                  { label: "Members", value: "1,247+" },
                  { label: "Channels", value: "50+" },
                  { label: "Active", value: "24/7" },
                  { label: "Security", value: "MAX" },
                ].map((item) => (
                  <div key={item.label} className="text-center" data-testid={`discord-stat-${item.label.toLowerCase()}`}>
                    <div className="text-2xl font-bold text-primary font-mono mb-1">{item.value}</div>
                    <div className="text-xs text-muted-foreground font-mono tracking-wider">{item.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <div className="font-mono text-sm text-primary mb-1">CARTEL NETWORK</div>
              <div className="text-xs text-muted-foreground font-mono">
                © {new Date().getFullYear()} - ALL SYSTEMS OPERATIONAL
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="font-mono text-xs border-primary/30" data-testid="badge-encrypted">
                <Shield className="w-3 h-3 mr-1" />
                ENCRYPTED
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-primary/30" data-testid="badge-secure">
                <Zap className="w-3 h-3 mr-1" />
                SECURE
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
