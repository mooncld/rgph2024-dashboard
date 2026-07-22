import { Check, Mail, Sparkles } from "lucide-react";

const FEATURES = [
  "Visualisations automatiques",
  "Filtres intelligents et dynamiques",
  "Cartes interactives et analyses géographiques",
  "Recherche en langage naturel",
  "Indicateurs et analyses personnalisés",
];

const CONTACT_EMAIL = "aya.lalou@e-polytechnique.ma";

export function AuthorCard() {
  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-3.5 text-xs leading-relaxed">
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br from-accent to-accent-2 opacity-20 blur-2xl" />

      <div className="relative z-10 flex items-center gap-1.5 mb-2">
        <Sparkles size={13} className="text-accent-2 shrink-0" />
        <p className="font-semibold text-foreground">Réalisé par Aya LALOU</p>
      </div>

      <p className="relative z-10 text-muted mb-2">
        🚀 Pour une plateforme décisionnelle intelligente transformant instantanément tout fichier Excel ou CSV en une
        interface web interactive comprenant&nbsp;:
      </p>

      <ul className="relative z-10 flex flex-col gap-1 mb-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-muted">
            <Check size={12} className="text-success mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <p className="relative z-10 text-muted mb-2.5">
        Grâce à notre solution, passez de milliers de lignes de données à une expérience d&apos;analyse moderne,
        intuitive, rapide et accessible.
      </p>

      <p className="relative z-10 text-foreground/90 mb-1.5">
        📩 Intéressé(e) par une démonstration ou un devis gratuit&nbsp;? Contactez-nous&nbsp;:
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="relative z-10 flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 font-medium text-accent hover:bg-accent/20 transition-colors break-all"
      >
        <Mail size={12} className="shrink-0" />
        {CONTACT_EMAIL}
      </a>
    </div>
  );
}
