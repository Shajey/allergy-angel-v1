import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageShell, { PageShellContent } from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";

/**
 * ClinicianTodayPage - A visual demo of the clinician hero variant.
 * This page uses static placeholders and existing Card components.
 */
export default function ClinicianTodayPage() {
  return (
    <PageShell>
      {/* Clinician Hero Header */}
      <PageHeader
        title="Today"
        eyebrow="Dashboard"
        subtitle="Operational view for Azalea R."
        badge="RN / PT / HHA"
        hero
        viewMode="clinician"
      />

      {/* Main Content */}
      <PageShellContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Next Visit Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl font-semibold">Next Visit</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                    Home Visit
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                    Confirmed
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="font-medium">Today at 2:00 PM</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>Patient: John Smith</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open Tasks Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl font-semibold">Open Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Complete visit documentation
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Due: Today</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Review patient care plan
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Due: Tomorrow</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Submit weekly report
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Due: Friday</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Notes Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl font-semibold">Recent Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <div className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm text-gray-900">
                    Patient vitals stable. Blood pressure 120/80.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                </div>
                <div className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm text-gray-900">
                    Medication reconciliation completed. No changes.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Yesterday</p>
                </div>
                <div className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm text-gray-900">
                    Follow-up call scheduled with primary care.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">2 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShellContent>
    </PageShell>
  );
}
