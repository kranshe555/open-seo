import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  BookOpen,
  Sparkles,
  Layers,
  Activity,
  Calendar,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import {
  getPerformanceOverview,
  getPerformancePages,
  getPerformanceKeywords,
  getPerformanceAnalysis,
} from "@/serverFunctions/performance";

export const Route = createFileRoute("/_project/p/$projectId/performance")({
  component: PerformanceRoute,
});

function PerformanceRoute() {
  const { projectId } = Route.useParams();
  
  // Date ranges
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // up to yesterday
    return d.toISOString().split("T")[0];
  });

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [pagesData, setPagesData] = useState<any>(null);
  const [keywordsData, setKeywordsData] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<"overview" | "keywords" | "pages">("overview");
  
  // AI Analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setAiAnalysis("");
    try {
      const [ov, pg, kw] = await Promise.all([
        getPerformanceOverview({ data: { start: startDate, end: endDate } }) as any,
        getPerformancePages({ data: { start: startDate, end: endDate } }) as any,
        getPerformanceKeywords({ data: { start: startDate, end: endDate } }) as any,
      ]);
      setOverview(ov?.data || null);
      setPagesData(pg?.data || null);
      setKeywordsData(kw?.data || null);
    } catch (err) {
      console.error("Error fetching performance reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleRunAiAnalysis = async () => {
    if (!overview) return;
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const reportData = {
        overview,
        pages: pagesData?.pages?.slice(0, 10),
        keywords: keywordsData?.keywords?.slice(0, 15),
      };
      const result = await getPerformanceAnalysis({
        data: { reportData, reportType: activeTab },
      }) as any;
      if (result?.ok) {
        setAiAnalysis(result.analysis || result.data || "فشل توليد التقرير");
      } else {
        setAiAnalysis("حدث خطأ أثناء الاتصال بـ DeepSeek");
      }
    } catch (err: any) {
      setAiAnalysis(`فشل جلب تحليل الذكاء الاصطناعي: ${err?.message || err}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <BarChart3 className="size-7" />
            تقارير الأداء الذكية (GSC + GA4)
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            تحليل أداء الزحف والظهور والنقرات، المربوط مع محرك ديب سيك للتوصيات التلقائية.
          </p>
        </div>

        {/* Date Selection */}
        <div className="flex flex-wrap items-center gap-2 bg-base-200 p-2 rounded-lg text-sm">
          <Calendar className="size-4 text-base-content/60" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input input-sm bg-base-100 border-base-300 w-36 text-center font-bold"
          />
          <span className="text-base-content/40">إلى</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input input-sm bg-base-100 border-base-300 w-36 text-center font-bold"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !overview ? (
        <div className="flex justify-center items-center py-20">
          <span className="loading loading-ring loading-lg text-primary"></span>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          {overview && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card Clicks */}
              <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                <div className="text-xs text-base-content/60 font-bold">النقرات (Clicks)</div>
                <div className="text-2xl font-black text-primary mt-1">
                  {overview.gsc.clicks.current.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-xs mt-2 font-semibold">
                  {overview.gsc.clicks.change_pct >= 0 ? (
                    <span className="text-success inline-flex items-center gap-0.5">
                      <TrendingUp className="size-3" />+{overview.gsc.clicks.change_pct}%
                    </span>
                  ) : (
                    <span className="text-error inline-flex items-center gap-0.5">
                      <TrendingDown className="size-3" />{overview.gsc.clicks.change_pct}%
                    </span>
                  )}
                  <span className="text-base-content/40">مقارنة بالفترة السابقة ({overview.gsc.clicks.previous.toLocaleString()})</span>
                </div>
              </div>

              {/* Card Impressions */}
              <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                <div className="text-xs text-base-content/60 font-bold">الظهور (Impressions)</div>
                <div className="text-2xl font-black mt-1">
                  {overview.gsc.impressions.current.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-xs mt-2 font-semibold">
                  {overview.gsc.impressions.change_pct >= 0 ? (
                    <span className="text-success inline-flex items-center gap-0.5">
                      <TrendingUp className="size-3" />+{overview.gsc.impressions.change_pct}%
                    </span>
                  ) : (
                    <span className="text-error inline-flex items-center gap-0.5">
                      <TrendingDown className="size-3" />{overview.gsc.impressions.change_pct}%
                    </span>
                  )}
                  <span className="text-base-content/40">السابق ({overview.gsc.impressions.previous.toLocaleString()})</span>
                </div>
              </div>

              {/* Card CTR */}
              <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                <div className="text-xs text-base-content/60 font-bold">نسبة النقر (CTR)</div>
                <div className="text-2xl font-black text-secondary mt-1">
                  {overview.gsc.ctr.current}%
                </div>
                <div className="flex items-center gap-1 text-xs mt-2 font-semibold">
                  {overview.gsc.ctr.change_pct >= 0 ? (
                    <span className="text-success inline-flex items-center gap-0.5">
                      <TrendingUp className="size-3" />+{overview.gsc.ctr.change_pct}%
                    </span>
                  ) : (
                    <span className="text-error inline-flex items-center gap-0.5">
                      <TrendingDown className="size-3" />{overview.gsc.ctr.change_pct}%
                    </span>
                  )}
                  <span className="text-base-content/40">السابق ({overview.gsc.ctr.previous}%)</span>
                </div>
              </div>

              {/* Card Position */}
              <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                <div className="text-xs text-base-content/60 font-bold">متوسط الترتيب (Position)</div>
                <div className="text-2xl font-black mt-1">
                  {overview.gsc.position.current}
                </div>
                <div className="flex items-center gap-1 text-xs mt-2 font-semibold">
                  {overview.gsc.position.change <= 0 ? (
                    <span className="text-success inline-flex items-center gap-0.5">
                      <TrendingUp className="size-3" /> تحسن {Math.abs(overview.gsc.position.change)}
                    </span>
                  ) : (
                    <span className="text-error inline-flex items-center gap-0.5">
                      <TrendingDown className="size-3" /> تراجع {overview.gsc.position.change}
                    </span>
                  )}
                  <span className="text-base-content/40">السابق ({overview.gsc.position.previous})</span>
                </div>
              </div>
            </div>
          )}

          {/* Core Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Table and Data column */}
            <div className="xl:col-span-2 space-y-4">
              <div className="tabs tabs-boxed bg-base-200">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`tab font-bold ${activeTab === "overview" ? "tab-active bg-primary text-white" : ""}`}
                >
                  <Layers className="size-4 ml-1 inline" /> نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab("keywords")}
                  className={`tab font-bold ${activeTab === "keywords" ? "tab-active bg-primary text-white" : ""}`}
                >
                  <Search className="size-4 ml-1 inline" /> الكلمات المستهدفة
                </button>
                <button
                  onClick={() => setActiveTab("pages")}
                  className={`tab font-bold ${activeTab === "pages" ? "tab-active bg-primary text-white" : ""}`}
                >
                  <BookOpen className="size-4 ml-1 inline" /> الصفحات الأكثر ترافيك
                </button>
              </div>

              <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <h3 className="font-black text-lg text-base-content flex items-center gap-1.5">
                      <Activity className="size-5 text-primary" /> تفاصيل مؤشرات الأداء الحالية
                    </h3>
                    <p className="text-sm text-base-content/70 leading-relaxed">
                      هذا التقرير يربط بين بيانات **Google Search Console** مع **Google Analytics 4** لتقييم كفاءة التراكم الصافي للترافيك.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="bg-base-200 p-4 rounded-lg">
                        <h4 className="font-bold text-sm mb-2 text-primary">أهداف السيو الذكي هذا الشهر:</h4>
                        <ul className="text-xs space-y-2 text-base-content/80 list-disc list-inside">
                          <li>تحويل كلمات الـ Striking Distance (المراكز 5-15) إلى المراكز الثلاثة الأولى.</li>
                          <li>تقليل معدل التراجع للكلمات الرئيسية.</li>
                          <li>تحسين الـ CTR الخارجي عبر العناوين الجذابة والخصومات المحدثة.</li>
                        </ul>
                      </div>
                      <div className="bg-base-200 p-4 rounded-lg">
                        <h4 className="font-bold text-sm mb-2 text-secondary">إحصائيات مقارنة الترافيك:</h4>
                        <p className="text-xs leading-relaxed text-base-content/80">
                          النقرات ارتفعت بنسبة **{overview?.gsc.clicks.change_pct}%** لتصل إلى **{overview?.gsc.clicks.current}** نقرة فعلية، مدفوعة بزيادة الظهور بنسبة **{overview?.gsc.impressions.change_pct}%** في نتائج البحث.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "keywords" && keywordsData && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm table-zebra w-full text-right">
                      <thead>
                        <tr className="text-xs text-base-content/50 border-b border-base-300">
                          <th className="font-bold py-2">الكلمة المفتاحية (Keyword)</th>
                          <th className="font-bold text-center">النقرات</th>
                          <th className="font-bold text-center">الظهور</th>
                          <th className="font-bold text-center">نسبة CTR</th>
                          <th className="font-bold text-center">الترتيب الحقيقي</th>
                          <th className="font-bold text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {keywordsData.keywords?.slice(0, 15).map((kw: any, idx: number) => (
                          <tr key={idx} className="border-b border-base-100 hover:bg-base-200/50">
                            <td className="font-bold text-base-content">{kw.query}</td>
                            <td className="text-center font-semibold">{kw.clicks}</td>
                            <td className="text-center text-base-content/70">{kw.impressions}</td>
                            <td className="text-center text-secondary font-bold">{kw.ctr}%</td>
                            <td className="text-center font-bold">{kw.position}</td>
                            <td className="text-center">
                              <span className={`badge badge-xs border-none font-bold text-white px-2 py-1.5 ${
                                kw.direction.includes("Improved") ? "bg-success" : kw.direction.includes("Stable") ? "bg-warning" : "bg-error"
                              }`}>
                                {kw.direction.includes("Improved") ? "تحسن" : kw.direction.includes("Stable") ? "مستقر" : "تراجع"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "pages" && pagesData && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm table-zebra w-full text-right">
                      <thead>
                        <tr className="text-xs text-base-content/50 border-b border-base-300">
                          <th className="font-bold py-2">عنوان الرابط (Page URL)</th>
                          <th className="font-bold text-center">النقرات</th>
                          <th className="font-bold text-center">الظهور</th>
                          <th className="font-bold text-center">نسبة CTR</th>
                          <th className="font-bold text-center">الترتيب</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {pagesData.pages?.slice(0, 15).map((page: any, idx: number) => {
                          // Extract slug or simple path
                          const cleanPath = page.url.replace("https://goldencouponzz.com", "");
                          return (
                            <tr key={idx} className="border-b border-b-base-100 hover:bg-base-200/50">
                              <td className="font-bold text-primary truncate max-w-[280px]">
                                <a href={page.url} target="_blank" rel="noreferrer" title={page.url}>
                                  {decodeURIComponent(cleanPath)}
                                </a>
                              </td>
                              <td className="text-center font-semibold">{page.clicks}</td>
                              <td className="text-center text-base-content/70">{page.impressions}</td>
                              <td className="text-center text-secondary font-bold">{page.ctr}%</td>
                              <td className="text-center font-bold">{page.position}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* AI analysis column */}
            <div className="space-y-4">
              <div className="card bg-base-100 border border-base-300 shadow-sm p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-black text-lg text-primary flex items-center gap-1.5">
                      <Sparkles className="size-5 text-secondary animate-pulse" />
                      استشارة الذكاء الاصطناعي (DeepSeek)
                    </h3>
                  </div>
                  <p className="text-xs text-base-content/60 leading-relaxed mb-4">
                    سيقوم محرك ديب سيك بفحص بيانات الظهور والـ CTR المحددة واستخراج أفضل 3 فرص سريعة لتحقيق قفزة في الترافيك لهذا المقال.
                  </p>

                  {aiAnalysis ? (
                    <div className="bg-base-200/60 p-4 rounded-lg text-xs leading-relaxed text-base-content space-y-2 overflow-y-auto max-h-[45vh] border border-base-300 font-sans whitespace-pre-line">
                      {aiAnalysis}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-base-300 rounded-lg py-12 text-center text-xs text-base-content/40 flex flex-col items-center justify-center gap-2">
                      <Sparkles className="size-8 text-base-content/20" />
                      لا يوجد تحليل نشط حالياً للفترة الحالية
                    </div>
                  )}
                </div>

                <button
                  onClick={handleRunAiAnalysis}
                  disabled={aiLoading || !overview}
                  className="btn btn-primary btn-sm w-full mt-4 text-white font-bold gap-2"
                >
                  {aiLoading ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      جاري تحليل التقرير...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      شغل التحليل الذكي للبيانات (ديب سيك)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
