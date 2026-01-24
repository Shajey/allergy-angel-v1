import { useNavigate } from "react-router-dom";
import { useViewMode } from "@/context/ViewModeContext";
import type { ViewMode, IdentityRole } from "@/context/ViewModeContext";
import { ValueCard } from "@/components/landing/ValueCard";
import { cn } from "@/lib/utils";
import { setActivePatientId, getSelfPatient, getCaregiverPatients, getSession } from "@/lib/sessionStore";

interface PersonaButtonProps {
  label: string;
  sublabel?: string;
  accentColor: "green" | "blue" | "purple" | "gray";
  onClick: () => void;
}

/**
 * PersonaButton - A styled button for persona selection.
 */
function PersonaButton({ label, sublabel, accentColor, onClick }: PersonaButtonProps) {
  const borderColorMap: Record<string, string> = {
    green: "border-l-emerald-500 hover:bg-emerald-50",
    blue: "border-l-blue-500 hover:bg-blue-50",
    purple: "border-l-purple-500 hover:bg-purple-50",
    gray: "border-l-slate-400 hover:bg-slate-50",
  };

  const dotColorMap: Record<string, string> = {
    green: "bg-emerald-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    gray: "bg-slate-400",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full",
        "bg-white rounded-lg border border-gray-200",
        "border-l-4 px-4 py-3",
        "transition-all duration-200",
        "text-left",
        borderColorMap[accentColor]
      )}
    >
      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dotColorMap[accentColor])} />
      <div className="flex-1">
        <span className="font-medium text-gray-900">{label}</span>
        {sublabel && (
          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {sublabel}
          </span>
        )}
      </div>
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * HeroIllustration - Decorative abstract illustration placeholder.
 * Uses gradient and blurred circles to create a soft, modern look.
 */
function HeroIllustration() {
  return (
    <div className="relative w-full h-64 lg:h-80 rounded-3xl overflow-hidden">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/80 via-teal-50/60 to-blue-100/50" />

      {/* Decorative blurred circles */}
      <div className="absolute top-8 right-8 w-32 h-32 bg-emerald-200/60 rounded-full blur-2xl" />
      <div className="absolute bottom-12 left-12 w-24 h-24 bg-blue-200/50 rounded-full blur-2xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-teal-100/70 rounded-full blur-3xl" />

      {/* Abstract shapes */}
      <div className="absolute top-16 right-16 w-16 h-16 bg-white/40 rounded-2xl rotate-12" />
      <div className="absolute bottom-20 right-24 w-12 h-12 bg-emerald-300/30 rounded-xl -rotate-6" />
      <div className="absolute top-24 left-1/4 w-8 h-8 bg-blue-300/40 rounded-lg rotate-45" />

      {/* Center icon/symbol placeholder */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="w-24 h-24 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg flex items-center justify-center">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DemoLoginPage - Landing page with persona selection.
 * Matches the reference design with hero section + value cards.
 */
function DemoLoginPage() {
  const { setViewMode, setIdentityRole } = useViewMode();
  const navigate = useNavigate();

  const handlePersonaSelect = (persona: ViewMode) => {
    // Set identityRole - this is the source of truth for role labels
    setIdentityRole(persona as IdentityRole);
    
    // Set viewMode and configure activePatientId based on identity
    switch (persona) {
      case "patient": {
        setViewMode("patient");
        // Patient identity: always view own data
        const selfPatient = getSelfPatient();
        if (selfPatient) {
          setActivePatientId(selfPatient.id);
        }
        break;
      }
      case "caregiver": {
        setViewMode("caregiver");
        // Caregiver identity: select first managed patient
        const caregiverPatients = getCaregiverPatients();
        if (caregiverPatients.length > 0) {
          setActivePatientId(caregiverPatients[0].id);
        }
        break;
      }
      case "clinician": {
        setViewMode("clinician");
        // Clinician Phase 1: "login as patient" mode - select first available patient
        const session = getSession();
        if (session.patients.length > 0) {
          setActivePatientId(session.patients[0].id);
        }
        break;
      }
      case "developer": {
        // Developer: default to caregiver view, can switch freely
        setViewMode("caregiver");
        const devPatients = getCaregiverPatients();
        if (devPatients.length > 0) {
          setActivePatientId(devPatients[0].id);
        }
        break;
      }
    }
    
    window.dispatchEvent(new Event('session-changed'));
    navigate("/today");
  };

  const valueCards = [
    { title: "One portal", description: "Everything in one place.", accent: "green" as const },
    { title: "Documents", description: "Upload and track forms fast.", accent: "blue" as const },
    { title: "Care Plan", description: "Know what's needed next.", accent: "purple" as const },
    { title: "Messaging", description: "Reach your care team easily.", accent: "amber" as const },
    { title: "Timeline", description: "See your care journey.", accent: "teal" as const },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="w-full">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
          {/* Hero container with soft mint/teal background */}
          <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-blue-50/40 overflow-hidden">
            {/* Subtle background pattern overlay */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-100 rounded-full blur-3xl" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-100 rounded-full blur-3xl" />
            </div>

            {/* Content grid */}
            <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 p-8 lg:p-12">
              {/* Left column: Text + Persona Selection */}
              <div className="flex flex-col justify-center space-y-6">
                {/* Brand Wordmark */}
                <span className="text-xl lg:text-2xl font-semibold text-emerald-700 tracking-tight">
                  CareOS
                </span>

                {/* Headline */}
                <div className="space-y-3">
                  <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight">
                    Do more.
                    <br />
                    Be supported.
                  </h1>

                  {/* Raison d'être */}
                  <p className="text-gray-600 text-base lg:text-lg max-w-md leading-relaxed">
                    CareOS is a care platform connecting patients, caregivers, clinicians, and health plans.
                  </p>
                </div>

                {/* Paragraph */}
                <p className="text-gray-500 text-sm lg:text-base max-w-md leading-relaxed">
                  Select how you're entering this portal to continue. Your experience will be
                  tailored to your role.
                </p>

                {/* Persona Selection */}
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-gray-700">Continue as:</p>
                  <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
                    <PersonaButton
                      label="Patient"
                      accentColor="green"
                      onClick={() => handlePersonaSelect("patient")}
                    />
                    <PersonaButton
                      label="Caregiver"
                      accentColor="blue"
                      onClick={() => handlePersonaSelect("caregiver")}
                    />
                    <PersonaButton
                      label="Clinician"
                      sublabel="Phase 2"
                      accentColor="purple"
                      onClick={() => handlePersonaSelect("clinician")}
                    />
                    <PersonaButton
                      label="Developer"
                      sublabel="Demo tools"
                      accentColor="gray"
                      onClick={() => handlePersonaSelect("developer")}
                    />
                  </div>
                </div>
              </div>

              {/* Right column: Illustration */}
              <div className="hidden lg:flex items-center justify-center">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Cards Section */}
      <section className="w-full pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
            {valueCards.map((card) => (
              <ValueCard
                key={card.title}
                title={card.title}
                description={card.description}
                accentColor={card.accent}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer note */}
      <footer className="w-full pb-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center space-y-1">
            <p className="text-xs text-gray-400">
              This is a prototype portal for demonstration purposes.
            </p>
            <p className="text-xs text-gray-400">
              All patient information and data shown is sample data only.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DemoLoginPage;
