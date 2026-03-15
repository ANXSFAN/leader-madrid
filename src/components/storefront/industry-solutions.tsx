"use client";

import { Link } from "@/i18n/navigation";
import { ArrowRight, Briefcase, Home, Factory } from "lucide-react";
import { useTranslations } from "next-intl";

interface IndustrySolutionsProps {
  categories?: { slug: string; name: string }[];
}

export function IndustrySolutions({ categories }: IndustrySolutionsProps) {
  const t = useTranslations("home");

  const defaultSolutions = [
    {
      id: "commercial",
      title: t("commercial_lighting"),
      desc: t("commercial_lighting_desc"),
      icon: Briefcase,
    },
    {
      id: "home",
      title: t("home_lighting"),
      desc: t("home_lighting_desc"),
      icon: Home,
    },
    {
      id: "industrial",
      title: t("industrial_lighting"),
      desc: t("industrial_lighting_desc"),
      icon: Factory,
    },
  ];

  const icons = [Briefcase, Home, Factory];
  const solutions = categories && categories.length >= 3
    ? categories.slice(0, 3).map((cat, i) => ({
        id: cat.slug,
        title: cat.name,
        desc: "",
        icon: icons[i] || Briefcase,
        href: `/category/${cat.slug}`,
      }))
    : defaultSolutions.map((s) => ({
        ...s,
        href: `/search?application=${s.id}`,
      }));

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-6">
            {t("industry_solutions")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("industry_solutions_subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {solutions.map((item) => (
            <Link 
              key={item.id} 
              href={item.href}
              className="group relative bg-card rounded-xl border border-border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 hover:border-accent/30"
            >
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-accent group-hover:scale-110 transition-all duration-300">
                  <item.icon size={28} className="text-accent group-hover:text-accent-foreground transition-colors" />
                </div>
                
                <div className="flex-grow">
                  <h3 className="text-3xl font-bold text-foreground mb-4 group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="flex items-center font-bold text-lg text-muted-foreground mt-8 group-hover:text-accent transition-colors">
                  {t("explore_solution")} 
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
