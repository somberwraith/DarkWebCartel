import { useState, useEffect, useRef } from "react";
import { Shield, Clock, User, Calendar, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Appeal() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    userId: "",
    denialDate: "",
    appealReason: "",
  });
  const [captchaToken, setCaptchaToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set up global callback before loading script
    (window as any).onCaptchaSuccess = (token: string) => {
      setCaptchaToken(token);
    };

    // Hardcoded hCaptcha sitekey - Replace with your actual sitekey from https://dashboard.hcaptcha.com/
    const sitekey = 'YOUR_ACTUAL_HCAPTCHA_SITEKEY_HERE';

    // Function to render hCaptcha
    const renderCaptcha = () => {
      if (captchaRef.current && (window as any).hcaptcha) {
        try {
          // Clear any existing widget
          if (captchaRef.current.innerHTML) {
            captchaRef.current.innerHTML = '';
          }

          (window as any).hcaptcha.render(captchaRef.current, {
            sitekey: sitekey,
            callback: 'onCaptchaSuccess',
          });
          console.log('[hCaptcha] Widget rendered successfully');
        } catch (error) {
          console.error('[hCaptcha] Render error:', error);
        }
      }
    };

    // Check if hCaptcha is already loaded
    if ((window as any).hcaptcha) {
      renderCaptcha();
    } else {
      // Load hCaptcha script if not already loaded
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoad&render=explicit';
      script.async = true;
      script.defer = true;

      // Set up onload callback
      (window as any).onHcaptchaLoad = () => {
        console.log('[hCaptcha] Script loaded');
        renderCaptcha();
      };

      script.onerror = () => {
        console.error('[hCaptcha] Failed to load script');
      };

      document.body.appendChild(script);

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  const validateDiscordId = (id: string): boolean => {
    // Discord IDs are 17-19 characters long and consist only of digits
    return /^\d{17,19}$/.test(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDiscordId(formData.userId)) {
      toast({
        title: "Invalid Discord ID",
        description: "Please enter a valid Discord user ID (17-19 digits)",
        variant: "destructive",
      });
      return;
    }

    if (!captchaToken) {
      toast({
        title: "Verification Required",
        description: "Please complete the CAPTCHA verification",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          captchaToken,
        }),
      });

      if (response.ok) {
        toast({
          title: "Appeal Submitted",
          description: "Your appeal has been received and will be reviewed.",
        });
        setFormData({
          userId: "",
          denialDate: "",
          appealReason: "",
        });
        setCaptchaToken("");
        // Reset hCaptcha
        if (window.hcaptcha) {
          window.hcaptcha.reset();
        }
      } else {
        throw new Error("Submission failed");
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground scanline crt-screen">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
              <span className="font-mono text-xs tracking-wider text-muted-foreground">APPEAL SYSTEM</span>
            </div>
          </div>
          <a href="/" className="text-xs text-muted-foreground font-mono tracking-wide hover:text-primary transition-colors">
            &lt; BACK TO MAIN
          </a>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-10">
        <div className="container mx-auto max-w-2xl">
          <Card className="border-primary/30 overflow-hidden">
            <div className="bg-card-border/50 px-6 py-3 border-b border-card-border flex items-center gap-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm tracking-wider text-foreground">JOIN_DENIAL_APPEAL.SYS</span>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-primary mb-3 font-mono tracking-wide">
                  &gt; SUBMIT_APPEAL
                </h1>
                <p className="text-muted-foreground text-sm font-mono">
                  If your join request was denied, you may submit an appeal below. All fields are required.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="font-mono text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    DISCORD USER ID
                  </Label>
                  <Input
                    id="userId"
                    type="text"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    placeholder="Enter your Discord user ID (17-19 digits)"
                    required
                    pattern="\d{17,19}"
                    maxLength={19}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    Discord user IDs are 17-19 digits long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="denialDate" className="font-mono text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    DENIAL DATE
                  </Label>
                  <Input
                    id="denialDate"
                    type="date"
                    value={formData.denialDate}
                    onChange={(e) => setFormData({ ...formData, denialDate: e.target.value })}
                    required
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appealReason" className="font-mono text-sm">
                    REASON FOR APPEAL
                  </Label>
                  <Textarea
                    id="appealReason"
                    value={formData.appealReason}
                    onChange={(e) => setFormData({ ...formData, appealReason: e.target.value })}
                    placeholder="Explain why your denial should be reconsidered..."
                    required
                    rows={6}
                    className="font-mono resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    VERIFICATION
                  </Label>
                  <div 
                    ref={captchaRef}
                    className="min-h-[78px] flex items-center justify-center"
                  ></div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full gap-2 font-mono tracking-wider"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "SUBMITTING..." : "SUBMIT APPEAL"}
                </Button>
              </form>

              <div className="mt-6 p-4 border border-primary/30 rounded bg-primary/5">
                <p className="text-xs text-muted-foreground font-mono">
                  <span className="text-primary">NOTE:</span> Appeals are reviewed manually. You will be contacted via your provided user ID if your appeal is accepted.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

declare global {
  interface Window {
    hcaptcha: any;
  }
}