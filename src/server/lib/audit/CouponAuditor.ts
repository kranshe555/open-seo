import * as cheerio from "cheerio";

export interface CouponAuditResult {
  ruleId: string;
  name: string;
  passed: boolean;
  details: string;
}

export interface CouponPageReport {
  isCouponOrStorePage: boolean;
  pageType: "store" | "coupon" | "generic";
  results: CouponAuditResult[];
  summary: {
    passedCount: number;
    failedCount: number;
    score: number; // 0 to 10
  };
}

const KW_PATTERN = /كود خصم|كوبون خصم|قسيمة|كوبون|كود|رمز خصم|رمز ترويجي|اكواد|كوبونات|خصم|تخفيض|coupon|discount code|discount|promo code|voucher code|voucher|code/i;
const CTA_PATTERN = /احصل|اشتر|استخدم|فعّل|فعل|اطلب|سارع|لا تفوت|اضغط|انسخ|طبق|وفر|تسوق|جرب|ابدأ|get|buy|shop|save|use|apply|grab|hurry|order|try|start|claim|redeem/gi;
const BANNED_WORDS = [
  "إعادة صياغة", "اعادة صياغة",
  "اسئلة مكررة", "أسئلة مكررة",
  "اسئلة شائعة", "أسئلة شائعة",
  "الأسئلة الشائعة", "الاسئلة الشائعة",
  "الأسئلة المكررة", "الاسئلة المكررة",
  "اسئله مكرره", "أسئله شائعه",
];
const BANNED_WORDS_REGEX = [/\brephrase\b/i, /\brewrite\b/i];

/**
 * Runs specialized coupons/stores validation rules on a crawled page HTML.
 */
export function auditCouponPage(html: string, url: string): CouponPageReport {
  const $ = cheerio.load(html);

  // Check if this page is a Coupon or Store page based on URL or content
  const isCouponOrStorePage =
    url.includes("/store/") ||
    url.includes("/coupon/") ||
    url.includes("coupon") ||
    KW_PATTERN.test($("title").text() || "") ||
    KW_PATTERN.test($("h1").first().text() || "");

  if (!isCouponOrStorePage) {
    return {
      isCouponOrStorePage: false,
      pageType: "generic",
      results: [],
      summary: { passedCount: 0, failedCount: 0, score: 0 },
    };
  }

  const pageType = url.includes("/coupon/") ? "coupon" : "store";
  const results: CouponAuditResult[] = [];

  const h1 = $("h1").first().text().trim();
  const title = $("title").first().text().trim();
  const desc = $('meta[name="description"]').first().attr("content")?.trim() ?? "";

  // === INTRO EXTRACTOR ===
  let headerIntro = "";
  const headerSection = $("section.custom-page-header.single-store-header");
  if (headerSection.length > 0) {
    const p = headerSection.find("div.header-content p").first();
    if (p.length > 0) {
      headerIntro = p.text().trim().substring(0, 200);
    }
  }

  let mainEl = $("#main-content");
  if (mainEl.length === 0) {
    mainEl = $(".panel");
  }

  let mainIntro = "";
  let content = "";
  if (mainEl.length > 0) {
    const clone = mainEl.clone();
    clone.find("script, style, noscript, svg").remove();
    content = clone.text().replace(/\s+/g, " ").trim();
    mainIntro = content.substring(0, 200);
  }

  const fullText = `${title} ${desc} ${headerIntro} ${mainIntro} ${content}`;

  // Helper to add audit rule results
  const addResult = (ruleId: string, name: string, passed: boolean, details: string) => {
    results.push({ ruleId, name, passed, details });
  };

  if (pageType === "store") {
    // 1. Meta Title check <= 60 characters
    addResult(
      "meta_title",
      "Meta Title ≤ 60 حرف",
      title.length <= 60,
      title.length <= 60 ? `✅ ${title.length} حرف` : `❌ ${title.length} حرف (أطول من 60)`
    );

    // 2. Meta Description check <= 155 characters
    addResult(
      "meta_desc",
      "Meta Description ≤ 155 حرف",
      desc.length <= 155,
      desc.length <= 155 ? `✅ ${desc.length} حرف` : `❌ ${desc.length} حرف (أطول من 155)`
    );

    // 3. H1 Check
    const h1Issues: string[] = [];
    if (h1.length > 60) h1Issues.push(`أطول من 60 حرف (${h1.length})`);
    if (h1 === title && h1.length > 0) h1Issues.push("مطابق لعنوان الميتا");
    addResult(
      "h1_check",
      "H1 ≤ 60 + مختلف عن Title",
      h1Issues.length === 0,
      h1Issues.length === 0 ? `✅ ${h1.length} حرف` : `❌ ${h1Issues.join(" | ")}`
    );

    // 4. Header Intro Check
    if (headerSection.length > 0) {
      const issues: string[] = [];
      if (!KW_PATTERN.test(headerIntro)) issues.push("غياب كلمة مفتاحية");
      if (!/\(\s*[A-Za-z0-9_\-]{2,}\s*\)/.test(headerIntro)) issues.push("غياب رمز الخصم بين أقواس");
      if (!/[%٪]/.test(headerIntro)) issues.push("غياب نسبة %");
      if (!headerIntro.includes("2026")) issues.push("غياب سنة 2026");
      addResult(
        "intro_header",
        "المقدمة (Header) — keyword + code + % + 2026",
        issues.length === 0,
        issues.length === 0 ? "✅ مطابقة" : `❌ ${issues.join(" | ")}`
      );
    } else {
      addResult("intro_header", "المقدمة (Header)", false, "❌ قسم الهيدر المخصص غير موجود");
    }

    // 5. Main Content Intro Check
    if (mainIntro) {
      const issues: string[] = [];
      if (!KW_PATTERN.test(mainIntro)) issues.push("غياب كلمة مفتاحية");
      if (!/\(\s*[A-Za-z0-9_\-]{2,}\s*\)/.test(mainIntro)) issues.push("غياب رمز الخصم بين أقواس");
      if (!/[%٪]/.test(mainIntro)) issues.push("غياب نسبة %");
      if (!mainIntro.includes("2026")) issues.push("غياب سنة 2026");
      addResult(
        "intro_main",
        "المقدمة (Main Content) — keyword + code + % + 2026",
        issues.length === 0,
        issues.length === 0 ? "✅ مطابقة" : `❌ ${issues.join(" | ")}`
      );
    } else {
      addResult("intro_main", "المقدمة (Main Content)", false, "❌ محتوى المقالة الرئيسي فارغ");
    }

    // 6. Keyword Frequency check >= 10
    const introSrc = headerIntro || mainIntro || h1;
    let bestKeyword = "";
    let bestKwCount = 0;

    // Match "كود خصم [store]"
    const kwArabicMatch = introSrc.match(/كود خصم\s+(\S+)/);
    if (kwArabicMatch) {
      const candidate = `كود خصم ${kwArabicMatch[1]}`;
      const count = (fullText.match(new RegExp(candidate, "gi")) || []).length;
      if (count > bestKwCount) {
        bestKwCount = count;
        bestKeyword = candidate;
      }
    }
    // Match "[store] discount code" etc
    for (const suffix of ["discount code", "coupon code", "promo code", "voucher code"]) {
      const regex = new RegExp(`(\\S+)\\s+${suffix}`, "i");
      const match = introSrc.match(regex);
      if (match) {
        const candidate = `${match[1]} ${suffix}`;
        const count = (fullText.match(new RegExp(candidate, "gi")) || []).length;
        if (count > bestKwCount) {
          bestKwCount = count;
          bestKeyword = candidate;
        }
      }
    }

    addResult(
      "keyword_freq",
      "تكرار الكلمة المفتاحية ≥ 10",
      bestKwCount >= 10,
      bestKwCount >= 10
        ? `✅ تكررت ${bestKwCount} مرة (الكلمة: ${bestKeyword})`
        : `❌ تكررت ${bestKwCount} مرة فقط (الكلمة: ${bestKeyword || "غير محددة"})`
    );

    // 7. Coupon Code Frequency Check (7 to 10)
    const introForCode = headerIntro || mainIntro;
    const codeMatch = introForCode.match(/\(\s*([A-Za-z0-9_\-]{2,})\s*\)/);
    if (codeMatch) {
      const code = codeMatch[1];
      const count = (fullText.match(new RegExp(code, "g")) || []).length;
      const ok = count >= 7 && count <= 10;
      addResult(
        "code_freq",
        "تكرار رمز الخصم بين 7 و 10",
        ok,
        ok
          ? `✅ تكرر ${count} مرة للكود (${code})`
          : `❌ تكرر ${count} مرة للكود (${code}) — مطلوب بين 7 و 10`
      );
    } else {
      addResult("code_freq", "تكرار رمز الخصم بين 7 و 10", false, "❌ لم يتم العثور على كود خصم بين أقواس بالمقدمة");
    }

    // 8. CTA Count check >= 3
    const ctaMatches = content.match(CTA_PATTERN) || [];
    addResult(
      "cta_count",
      "عدد CTA ≥ 3",
      ctaMatches.length >= 3,
      ctaMatches.length >= 3 ? `✅ يوجد ${ctaMatches.length} CTA` : `❌ يوجد ${ctaMatches.length} CTA فقط`
    );

    // 9. Heading Hierarchy check
    let headingBad = false;
    let headingBadDetail = "✅ سليم";
    if (mainEl.length > 0) {
      const headings = mainEl.find("h2, h3, h4");
      let prevLevel = 2;
      headings.each((_, el) => {
        const level = parseInt(el.tagName.toLowerCase().charAt(1), 10);
        if (level - prevLevel > 1) {
          headingBad = true;
          headingBadDetail = `❌ ترويسة h${level} بعد h${prevLevel} مباشرة: "${$(el).text().trim().substring(0, 30)}"`;
          return false; // break loop
        }
        prevLevel = level;
      });
    }
    addResult("heading_hierarchy", "ترتيب الترويسات", !headingBad, headingBadDetail);

    // 10. Consecutive headings check
    let consecBad = false;
    let consecDetail = "✅ لا يوجد";
    if (mainEl.length > 0) {
      const allElements = mainEl.find("h2, h3, h4, p, ul, ol, div, table, blockquote");
      let consecutiveCount = 0;
      allElements.each((_, el) => {
        if (["h2", "h3", "h4"].includes(el.tagName.toLowerCase())) {
          consecutiveCount++;
          if (consecutiveCount >= 2) {
            consecBad = true;
            consecDetail = `❌ ترويسة متتالية ${el.tagName.toLowerCase()}: "${$(el).text().trim().substring(0, 30)}"`;
            return false;
          }
        } else {
          if ($(el).text().trim().length > 5) {
            consecutiveCount = 0;
          }
        }
      });
    }
    addResult("consecutive_headings", "ترويسات متتالية بدون فاصل", !consecBad, consecDetail);

    // 11. FAQ Schema check
    const hasFaq = html.includes("FAQPage") || html.includes("schema.org/FAQPage");
    addResult("faq_schema", "سكيمة FAQ", hasFaq, hasFaq ? "✅ موجودة" : "❌ غير موجودة");

    // 12. Year Check (only 2026 allowed)
    const yearMatches = fullText.match(/(?<!\d)(20[2-3]\d)(?!\d)/g) || [];
    const badYears = new Set<string>();
    for (const ym of yearMatches) {
      if (ym === "2026") continue;
      // Simple verification context
      const idx = fullText.indexOf(ym);
      const ctx = fullText.substring(Math.max(0, idx - 30), Math.min(fullText.length, idx + 30));
      if (/ريال|جنيه|درهم|دينار|ر\.س|SAR|EGP|AED|USD|\$|€/i.test(ctx)) {
        continue; // skip price contexts
      }
      badYears.add(ym);
    }
    addResult(
      "year_check",
      "فحص السنوات",
      badYears.size === 0,
      badYears.size === 0 ? "✅ 2026 فقط" : `❌ وُجدت سنوات قديمة: ${Array.from(badYears).join(", ")}`
    );

    // 13. Banned words check
    const foundBanned: string[] = [];
    for (const word of BANNED_WORDS) {
      if (fullText.includes(word)) foundBanned.push(word);
    }
    for (const regex of BANNED_WORDS_REGEX) {
      const match = fullText.match(regex);
      if (match) foundBanned.push(match[0]);
    }
    addResult(
      "banned_words",
      "كلمات محظورة",
      foundBanned.length === 0,
      foundBanned.length === 0 ? "✅ لا يوجد" : `❌ وُجدت كلمات محظورة: ${foundBanned.join(", ")}`
    );

    // 14. Min images count >= 3
    let uniqueImgCount = 0;
    if (mainEl.length > 0) {
      const seenSrcs = new Set<string>();
      mainEl.find("img").each((_, el) => {
        const src = $(el).attr("data-lazy-src") || $(el).attr("data-src") || $(el).attr("src") || "";
        if (src.startsWith("data:") || !src) return;
        if (!seenSrcs.has(src)) {
          seenSrcs.add(src);
          uniqueImgCount++;
        }
      });
    }
    addResult(
      "min_images",
      "≥ 3 صور في المقالة",
      uniqueImgCount >= 3,
      uniqueImgCount >= 3 ? `✅ يوجد ${uniqueImgCount} صورة` : `❌ يوجد ${uniqueImgCount} صورة فقط (أقل من المطلوب 3)`
    );
  } else if (pageType === "coupon") {
    // 1. Coupon Length check >= 1000 chars
    addResult(
      "coupon_length",
      "طول المحتوى ≥ 1000 حرف",
      content.length >= 1000,
      content.length >= 1000 ? `✅ الطول ${content.length} حرف` : `❌ الطول ${content.length} حرف فقط (أقل من 1000)`
    );

    // 2. Coupon structure headings >= 3
    const hCount = $("h1, h2, h3, h4").length;
    addResult(
      "coupon_structure",
      "هيكل تنظيمي ≥ 3 عناوين",
      hCount >= 3,
      hCount >= 3 ? `✅ يحتوي على ${hCount} عناوين` : `❌ يحتوي على ${hCount} عناوين فقط (أقل من 3)`
    );

    // 3. Coupon Banned words
    const foundBanned: string[] = [];
    for (const word of BANNED_WORDS) {
      if (fullText.includes(word)) foundBanned.push(word);
    }
    addResult(
      "coupon_banned",
      "كلمات محظورة",
      foundBanned.length === 0,
      foundBanned.length === 0 ? "✅ لا يوجد" : `❌ وُجدت كلمات محظورة: ${foundBanned.join(", ")}`
    );

    // 4. Coupon internal link
    let hasStoreLink = false;
    if (mainEl.length > 0) {
      mainEl.find("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.includes("/store/")) {
          hasStoreLink = true;
          return false;
        }
      });
    }
    addResult(
      "coupon_internal_link",
      "Internal Link لمقالة المتجر",
      hasStoreLink,
      hasStoreLink ? "✅ موجود رابط للمتجر" : "❌ غائب — يجب ربط المقالة بصفحة المتجر الرئيسية"
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  const score = results.length > 0 ? Math.round((passedCount / results.length) * 10 * 10) / 10 : 0;

  return {
    isCouponOrStorePage: true,
    pageType,
    results,
    summary: { passedCount, failedCount, score },
  };
}
