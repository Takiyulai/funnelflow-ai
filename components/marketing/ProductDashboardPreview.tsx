import {
  ArrowUpRight, BarChart3, Check, ChevronRight, GitBranch,
  LayoutDashboard, Mail, MousePointerClick, Plus, Sparkles, Users,
} from "lucide-react";
import styles from "./ProductDashboardPreview.module.css";

const COPY = {
  fr: {
    caption: "Aperçu du produit · données d’illustration",
    workspace: "Votre espace de travail",
    nav: ["Tableau de bord", "Mes tunnels", "CRM", "Emails", "Workflows"],
    title: "Votre activité, au même endroit.",
    subtitle: "De la première visite à la prochaine vente.",
    period: "Cette semaine",
    create: "Créer un tunnel",
    metrics: ["Tunnels publiés", "Contacts dans le CRM", "Séquences actives"],
    funnels: "Vos tunnels",
    all: "Vue d’ensemble",
    funnelNames: ["Mon guide gratuit", "Mon prochain webinaire", "Mon accompagnement"],
    funnelTypes: ["Lead magnet · 2 pages", "Webinaire · 4 pages", "Coaching · 3 pages"],
    online: "En ligne",
    draft: "Brouillon",
    activity: "Nouveaux contacts",
    activityNote: "Votre audience devient une relation.",
    days: ["L", "M", "M", "J", "V", "S", "D"],
    automation: "Le suivi continue, automatiquement",
    flow: ["Inscription", "Ajout au CRM", "Email de bienvenue"],
    connected: "Tout est connecté",
  },
  en: {
    caption: "Product preview · illustrative data",
    workspace: "Your workspace",
    nav: ["Dashboard", "My funnels", "CRM", "Emails", "Workflows"],
    title: "Your business, in one place.",
    subtitle: "From the first visit to the next sale.",
    period: "This week",
    create: "Create a funnel",
    metrics: ["Published funnels", "CRM contacts", "Active sequences"],
    funnels: "Your funnels",
    all: "Overview",
    funnelNames: ["My free guide", "My next webinar", "My coaching program"],
    funnelTypes: ["Lead magnet · 2 pages", "Webinar · 4 pages", "Coaching · 3 pages"],
    online: "Live",
    draft: "Draft",
    activity: "New contacts",
    activityNote: "Turn your audience into relationships.",
    days: ["M", "T", "W", "T", "F", "S", "S"],
    automation: "Follow-up keeps running, automatically",
    flow: ["Sign-up", "Added to CRM", "Welcome email"],
    connected: "Everything is connected",
  },
  es: {
    caption: "Vista del producto · datos ilustrativos",
    workspace: "Tu espacio de trabajo",
    nav: ["Panel", "Mis embudos", "CRM", "Emails", "Workflows"],
    title: "Tu actividad, en un solo lugar.",
    subtitle: "De la primera visita a la próxima venta.",
    period: "Esta semana",
    create: "Crear un embudo",
    metrics: ["Embudos publicados", "Contactos en el CRM", "Secuencias activas"],
    funnels: "Tus embudos",
    all: "Vista general",
    funnelNames: ["Mi guía gratuita", "Mi próximo webinar", "Mi acompañamiento"],
    funnelTypes: ["Lead magnet · 2 páginas", "Webinar · 4 páginas", "Coaching · 3 páginas"],
    online: "En línea",
    draft: "Borrador",
    activity: "Nuevos contactos",
    activityNote: "Tu audiencia se convierte en una relación.",
    days: ["L", "M", "M", "J", "V", "S", "D"],
    automation: "El seguimiento continúa automáticamente",
    flow: ["Inscripción", "Añadido al CRM", "Email de bienvenida"],
    connected: "Todo está conectado",
  },
} as const;

const NAV_ICONS = [LayoutDashboard, MousePointerClick, Users, Mail, GitBranch];
const METRIC_ICONS = [MousePointerClick, Users, Mail];
const BAR_HEIGHTS = [24, 42, 34, 62, 50, 76, 92];

/** Product illustration, not a live account or a second interactive dashboard. */
export function ProductDashboardPreview({ language }: { language: keyof typeof COPY }) {
  const copy = COPY[language];
  return (
    <figure className={styles.preview} aria-label={copy.caption}>
      <div className={styles.windowBar} aria-hidden="true">
        <div className={styles.windowDots}><i /><i /><i /></div>
        <span>app.autofunnelai.cloud</span>
        <span className={styles.secure}><Check size={12} /> AutoFunnel AI</span>
      </div>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={styles.brand}><span>AF</span> AutoFunnel <b>AI</b></div>
          <p className={styles.workspaceLabel}>{copy.workspace}</p>
          <div className={styles.navigation}>
            {copy.nav.map((label, index) => {
              const Icon = NAV_ICONS[index];
              return <div key={label} className={index === 0 ? styles.navActive : styles.navItem}><Icon size={16} />{label}</div>;
            })}
          </div>
          <div className={styles.copilot}><Sparkles size={17} /><span>AutoFunnel AI<br /><small>{copy.connected}</small></span></div>
        </aside>
        <div className={styles.dashboard}>
          <div className={styles.dashboardHeader}>
            <div><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
            <span className={styles.create}><Plus size={14} />{copy.create}</span>
          </div>
          <div className={styles.metrics}>
            {copy.metrics.map((label, index) => {
              const Icon = METRIC_ICONS[index];
              return (
                <div className={styles.metric} key={label}>
                  <div><span>{label}</span><Icon size={16} /></div>
                  <strong>{["3", "128", "4"][index]}</strong>
                  <span className={styles.metricLine} />
                </div>
              );
            })}
          </div>
          <div className={styles.mainGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><h3>{copy.funnels}</h3><span>{copy.all}<ArrowUpRight size={12} /></span></div>
              <div className={styles.funnelList}>
                {copy.funnelNames.map((name, index) => (
                  <div className={styles.funnelRow} key={name}>
                    <span className={`${styles.funnelThumb} ${styles[`thumb${index}`]}`} aria-hidden="true"><i /><i /><i /></span>
                    <div className={styles.funnelInfo}><strong>{name}</strong><small>{copy.funnelTypes[index]}</small></div>
                    <span className={index === 2 ? styles.draft : styles.live}>{index === 2 ? copy.draft : copy.online}</span>
                    <ChevronRight className={styles.rowArrow} size={14} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </section>
            <section className={`${styles.panel} ${styles.activityPanel}`}>
              <div className={styles.panelHeading}><h3>{copy.activity}</h3><BarChart3 size={15} /></div>
              <div className={styles.chartSummary}><strong>128</strong><span>{copy.period}</span></div>
              <div className={styles.chart} aria-hidden="true">
                {BAR_HEIGHTS.map((height, index) => <div key={index}><i style={{ height: `${height}%` }} /><span>{copy.days[index]}</span></div>)}
              </div>
              <p className={styles.chartNote}>{copy.activityNote}</p>
            </section>
          </div>
          <div className={styles.automation}>
            <div className={styles.automationTitle}><GitBranch size={16} /><strong>{copy.automation}</strong></div>
            <div className={styles.flow}>{copy.flow.map((step, index) => <span key={step}><Check size={12} />{step}{index < copy.flow.length - 1 && <ChevronRight className={styles.flowArrow} size={14} />}</span>)}</div>
          </div>
        </div>
      </div>
      <figcaption>{copy.caption}</figcaption>
    </figure>
  );
}
