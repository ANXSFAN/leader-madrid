"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitContactForm } from "@/lib/actions/contact";
import { toast } from "sonner";
import { Loader2, Mail, Phone, MapPin, Send } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function ContactPage() {
  const t = useTranslations("contact");
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    company: "",
    phone: "",
    subject: "",
    message: "",
  });

  // Auto-fill when session loads
  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await submitContactForm(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSubmitted(true);
        toast.success(t("success"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Send className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-black text-foreground mb-4">{t("thank_you")}</h1>
        <p className="text-muted-foreground mb-8">{t("thank_you_desc")}</p>
        <Link href="/">
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
            {t("back_home")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-foreground uppercase tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">{t("subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("email_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("email_desc")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("phone_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("phone_desc")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("address_title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("address_desc")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">
                {t("form_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("name")} *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">{t("company")}</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={(e) => handleChange("company", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone")}</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">{t("subject")} *</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">{t("message")} *</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    required
                    minLength={10}
                    rows={6}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-black uppercase tracking-wider"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("submit")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
